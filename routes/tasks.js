const mongoose = require('mongoose');
const Task = require('../models/task');
const User = require('../models/user');

module.exports = function (router) {

  const tasksRoute = router.route('/');
  const tasksIdRoute = router.route('/:id');

  // POST /api/tasks
  tasksRoute.post(async function (req, res) {
    try {
      const { name, deadline, assignedUser } = req.body;
      if (!name || !deadline)
        return res.status(400).json({ message: 'Missing name or deadline', data: {} });

      // Validate assignedUser format and check existence
      if (assignedUser) {
        if (!mongoose.Types.ObjectId.isValid(assignedUser))
          return res.status(400).json({ message: 'Invalid user ID format', data: {} });

        const user = await User.findById(assignedUser);
        if (!user)
          return res.status(404).json({ message: 'Assigned user not found', data: {} });

        req.body.assignedUserName = user.name; // Auto-fill user name
      }

      const newTask = new Task(req.body);
      const vErr = newTask.validateSync();
      if (vErr)
        return res.status(400).json({ message: 'Validation failed', data: vErr });

      const run = async (session) => {
        await newTask.save(session ? { session } : undefined);

        if (newTask.assignedUser) {
          await User.findByIdAndUpdate(
            newTask.assignedUser,
            { $push: { pendingTasks: newTask._id } },
            session ? { session } : undefined
          );
        }
      };

      if (typeof mongoose.connection.transaction === 'function') {
        await mongoose.connection.transaction(async (session) => { await run(session); });
      } else {
        await run(null);
      }

      res.status(201).json({ message: 'Task created', data: newTask });
    } catch (err) {
      res.status(500).json({ message: 'Error creating task', data: {} });
    }
  });

  // GET /api/tasks
  tasksRoute.get(async function (req, res) {
    try {
      let query = Task.find();

      if (req.query.where)  query.find(JSON.parse(req.query.where));
      if (req.query.sort)   query.sort(JSON.parse(req.query.sort));
      if (req.query.select) query.select(JSON.parse(req.query.select));
      if (req.query.skip)   query.skip(parseInt(req.query.skip));

      // limit behavior
      if (Object.prototype.hasOwnProperty.call(req.query, 'limit')) {
        const raw = req.query.limit;
        const n = raw === '' || raw === undefined ? 100 : parseInt(raw);
        if (!Number.isNaN(n)) query.limit(n);
      }

      // count=true
      if (req.query.count === 'true') {
        const tasks = await query.exec();
        return res.status(200).json({ message: 'OK', data: tasks.length });
      }

      const tasks = await query.exec();
      res.status(200).json({ message: 'OK', data: tasks });
    } catch (_) {
      res.status(500).json({ message: 'Server Error', data: {} });
    }
  });

  // GET /api/tasks/:id
  tasksIdRoute.get(async function (req, res) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id))
        return res.status(400).json({ message: 'Invalid task ID format', data: {} });

      let query = Task.findById(req.params.id);
      if (req.query.select) query.select(JSON.parse(req.query.select));

      const task = await query.exec();
      if (!task) return res.status(404).json({ message: 'Task not found', data: {} });

      res.status(200).json({ message: 'OK', data: task });
    } catch (_) {
      res.status(500).json({ message: 'Server Error', data: {} });
    }
  });

  // PUT /api/tasks/:id
  tasksIdRoute.put(async function (req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid task ID format', data: {} });

      const { name, deadline, assignedUser } = req.body;
      if (!name || !deadline)
        return res.status(400).json({ message: 'Missing name or deadline', data: {} });

      // Do not allow updating dateCreated
      delete req.body.dateCreated;

      const oldTask = await Task.findById(id);
      if (!oldTask)
        return res.status(404).json({ message: 'Task not found', data: {} });

      // If assignedUser is specified, validate its existence
      if (assignedUser) {
        if (!mongoose.Types.ObjectId.isValid(assignedUser))
          return res.status(400).json({ message: 'Invalid user ID format', data: {} });
        const user = await User.findById(assignedUser);
        if (!user)
          return res.status(404).json({ message: 'Assigned user not found', data: {} });
        req.body.assignedUserName = user.name;
      } else {
        req.body.assignedUserName = "unassigned";
      }

      const run = async (session) => {
        // Remove old user's task binding
        if (oldTask.assignedUser && oldTask.assignedUser !== assignedUser) {
          await User.findByIdAndUpdate(
            oldTask.assignedUser,
            { $pull: { pendingTasks: oldTask._id } },
            session ? { session } : undefined
          );
        }
        // Add new user's task binding
        if (assignedUser) {
          await User.findByIdAndUpdate(
            assignedUser,
            { $addToSet: { pendingTasks: oldTask._id } },
            session ? { session } : undefined
          );
        }
        await Task.findByIdAndUpdate(id, req.body, { new: true, ...(session ? { session } : {}) });
      };

      if (typeof mongoose.connection.transaction === 'function') {
        await mongoose.connection.transaction(async (session) => { await run(session); });
      } else {
        await run(null);
      }

      const updated = await Task.findById(id);
      res.status(200).json({ message: 'Task updated', data: updated });
    } catch (_) {
      res.status(500).json({ message: 'Error updating task', data: {} });
    }
  });

  // DELETE /api/tasks/:id
  tasksIdRoute.delete(async function (req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid task ID format', data: {} });

      const task = await Task.findById(id);
      if (!task) return res.status(404).json({ message: 'Task not found', data: {} });

      const run = async (session) => {
        if (task.assignedUser) {
          await User.findByIdAndUpdate(
            task.assignedUser,
            { $pull: { pendingTasks: task._id } },
            session ? { session } : undefined
          );
        }
        await Task.findByIdAndDelete(id, session ? { session } : undefined);
      };

      if (typeof mongoose.connection.transaction === 'function') {
        await mongoose.connection.transaction(async (session) => { await run(session); });
      } else {
        await run(null);
      }

      res.status(200).json({ message: 'Task deleted', data: {} });
    } catch (_) {
      res.status(500).json({ message: 'Error deleting task', data: {} });
    }
  });

  return router;
};
