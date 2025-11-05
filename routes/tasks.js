const Task = require('../models/task');
const User = require('../models/user');

module.exports = function (router) {

    router.route('/')
        .get(async function (req, res) {
            try {
                let query = Task.find();

                if (req.query.where) query.find(JSON.parse(req.query.where));
                if (req.query.sort) query.sort(JSON.parse(req.query.sort));
                if (req.query.select) query.select(JSON.parse(req.query.select));
                if (req.query.skip) query.skip(parseInt(req.query.skip));
                if (req.query.limit) query.limit(parseInt(req.query.limit));

                if (req.query.count === 'true') {
                    const count = await query.countDocuments();
                    return res.status(200).json({ message: "OK", data: count });
                }

                const tasks = await query.exec();
                res.status(200).json({ message: "OK", data: tasks });
            } catch (err) {
                res.status(500).json({ message: "Server Error", data: err });
            }
        })
        .post(async function (req, res) {
            try {
                const { name, deadline } = req.body;
                if (!name || !deadline)
                    return res.status(400).json({ message: "Missing name or deadline", data: {} });

                const task = new Task(req.body);
                await task.save();

                if (task.assignedUser) {
                    await User.findByIdAndUpdate(task.assignedUser, { $push: { pendingTasks: task._id } });
                }

                res.status(201).json({ message: "Task created", data: task });
            } catch (err) {
                res.status(500).json({ message: "Error creating task", data: err });
            }
        });

    router.route('/:id')
        .get(async function (req, res) {
            try {
                let query = Task.findById(req.params.id);
                if (req.query.select) query.select(JSON.parse(req.query.select));

                const task = await query.exec();
                if (!task)
                    return res.status(404).json({ message: "Task not found", data: {} });

                res.status(200).json({ message: "OK", data: task });
            } catch (err) {
                res.status(500).json({ message: "Server Error", data: err });
            }
        })
        .put(async function (req, res) {
            try {
                const { name, deadline } = req.body;
                if (!name || !deadline)
                    return res.status(400).json({ message: "Missing name or deadline", data: {} });

                const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
                if (!task)
                    return res.status(404).json({ message: "Task not found", data: {} });

                if (task.assignedUser) {
                    await User.findByIdAndUpdate(task.assignedUser, { $addToSet: { pendingTasks: task._id } });
                }

                res.status(200).json({ message: "Task updated", data: task });
            } catch (err) {
                res.status(500).json({ message: "Error updating task", data: err });
            }
        })
        .delete(async function (req, res) {
            try {
                const task = await Task.findById(req.params.id);
                if (!task)
                    return res.status(404).json({ message: "Task not found", data: {} });

                if (task.assignedUser) {
                    await User.findByIdAndUpdate(task.assignedUser, { $pull: { pendingTasks: task._id } });
                }

                await Task.findByIdAndDelete(req.params.id);
                res.status(200).json({ message: "Task deleted", data: {} });
            } catch (err) {
                res.status(500).json({ message: "Error deleting task", data: err });
            }
        });

    return router;
};
