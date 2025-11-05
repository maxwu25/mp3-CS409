const mongoose = require('mongoose');
const User = require('../models/user');
const Task = require('../models/task');

module.exports = function (router) {

  const usersRoute = router.route('/');
  const usersIdRoute = router.route('/:id');

  // POST /api/users
  usersRoute.post(async function (req, res) {
    try {
      const { name, email } = req.body;
      if (!name || !email)
        return res.status(400).json({ message: 'Missing name or email', data: {} });

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: 'Email already exists', data: {} });

      const newUser = new User(req.body);
      await newUser.save();
      res.status(201).json({ message: 'User created', data: newUser });
    } catch (err) {
      res.status(500).json({ message: 'Error creating user', data: {} });
    }
  });

  // GET /api/users
  usersRoute.get(async function (req, res) {
    try {
      let query = User.find();
      if (req.query.where)  query.find(JSON.parse(req.query.where));
      if (req.query.sort)   query.sort(JSON.parse(req.query.sort));
      if (req.query.select) query.select(JSON.parse(req.query.select));
      if (req.query.skip)   query.skip(parseInt(req.query.skip));
      if (req.query.limit)  query.limit(parseInt(req.query.limit));

      if (req.query.count === 'true') {
        const count = await query.countDocuments();
        return res.status(200).json({ message: 'OK', data: count });
      }

      const result = await query.exec();
      res.status(200).json({ message: 'OK', data: result });
    } catch (_) {
      res.status(500).json({ message: 'Server Error', data: {} });
    }
  });

  // GET /api/users/:id
  usersIdRoute.get(async function (req, res) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id))
        return res.status(400).json({ message: 'Invalid user ID format', data: {} });

      let query = User.findById(req.params.id);
      if (req.query.select) query.select(JSON.parse(req.query.select));

      const user = await query.exec();
      if (!user) return res.status(404).json({ message: 'User not found', data: {} });

      res.status(200).json({ message: 'OK', data: user });
    } catch (_) {
      res.status(500).json({ message: 'Server Error', data: {} });
    }
  });

  // PUT /api/users/:id 
  usersIdRoute.put(async function (req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid user ID format', data: {} });

      const { name, email, pendingTasks } = req.body;
      if (!name || !email)
        return res.status(400).json({ message: 'Missing name or email', data: {} });

      const user = await User.findById(id);
      if (!user)
        return res.status(404).json({ message: 'User not found', data: {} });

      // Check if email already used by another user
      const duplicate = await User.findOne({ email, _id: { $ne: id } });
      if (duplicate)
        return res.status(400).json({ message: 'Email already exists', data: {} });

      // Validate and clean pendingTasks list
      if (pendingTasks) {
        // Remove duplicate task IDs
        const uniquePendingTasks = [...new Set(pendingTasks.map(t => t.toString()))];
        req.body.pendingTasks = uniquePendingTasks;

        // Validate each task
        for (const tid of uniquePendingTasks) {
          if (!mongoose.Types.ObjectId.isValid(tid))
            return res.status(400).json({ message: 'Invalid task ID format', data: {} });

          const task = await Task.findById(tid);
          if (!task)
            return res.status(404).json({ message: 'Task not found', data: {} });
          if (task.completed)
            return res.status(400).json({ message: 'Cannot assign completed task', data: {} });
          if (task.assignedUser && task.assignedUser.toString() !== id)
            return res.status(400).json({ message: 'Task already assigned to another user', data: {} });
        }

        // Unassign old tasks that are no longer in the new list
        const oldTasks = user.pendingTasks.map(t => t.toString());
        const toUnassign = oldTasks.filter(t => !uniquePendingTasks.includes(t));
        await Task.updateMany(
          { _id: { $in: toUnassign } },
          { assignedUser: '', assignedUserName: 'unassigned' }
        );

        // Assign new tasks that were not in the old list
        const toAssign = uniquePendingTasks.filter(t => !oldTasks.includes(t));
        await Task.updateMany(
          { _id: { $in: toAssign } },
          { assignedUser: id, assignedUserName: name }
        );
      }

      const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
      res.status(200).json({ message: 'User updated', data: updatedUser });
    } catch (err) {
      res.status(500).json({ message: 'Error updating user', data: {} });
    }
  });

  // DELETE /api/users/:id
  usersIdRoute.delete(async function (req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid user ID format', data: {} });

      const user = await User.findById(id);
      if (!user)
        return res.status(404).json({ message: 'User not found', data: {} });

      // Unassign all tasks belonging to this user
      await Task.updateMany(
        { assignedUser: id },
        { assignedUser: '', assignedUserName: 'unassigned' }
      );

      await User.findByIdAndDelete(id);
      res.status(200).json({ message: 'User deleted', data: {} });
    } catch (_) {
      res.status(500).json({ message: 'Error deleting user', data: {} });
    }
  });

  return router;
};
