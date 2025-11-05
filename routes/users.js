const User = require('../models/user');
const Task = require('../models/task');

module.exports = function (router) {

    // /api/users
    router.route('/')
        .get(async function (req, res) {
            try {
                let query = User.find();

                if (req.query.where) query.find(JSON.parse(req.query.where));
                if (req.query.sort) query.sort(JSON.parse(req.query.sort));
                if (req.query.select) query.select(JSON.parse(req.query.select));
                if (req.query.skip) query.skip(parseInt(req.query.skip));
                if (req.query.limit) query.limit(parseInt(req.query.limit));

                if (req.query.count === 'true') {
                    const count = await query.countDocuments();
                    return res.status(200).json({ message: "OK", data: count });
                }

                const users = await query.exec();
                res.status(200).json({ message: "OK", data: users });
            } catch (err) {
                res.status(500).json({ message: "Server Error", data: err });
            }
        })
        .post(async function (req, res) {
            try {
                const { name, email } = req.body;
                if (!name || !email)
                    return res.status(400).json({ message: "Missing name or email", data: {} });

                const user = new User(req.body);
                await user.save();
                res.status(201).json({ message: "User created", data: user });
            } catch (err) {
                res.status(500).json({ message: "Error creating user", data: err });
            }
        });

    // /api/users/:id
    router.route('/:id')
        .get(async function (req, res) {
            try {
                let query = User.findById(req.params.id);
                if (req.query.select) query.select(JSON.parse(req.query.select));

                const user = await query.exec();
                if (!user)
                    return res.status(404).json({ message: "User not found", data: {} });

                res.status(200).json({ message: "OK", data: user });
            } catch (err) {
                res.status(500).json({ message: "Server Error", data: err });
            }
        })
        .put(async function (req, res) {
            try {
                const { name, email } = req.body;
                if (!name || !email)
                    return res.status(400).json({ message: "Missing name or email", data: {} });

                const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
                if (!updatedUser)
                    return res.status(404).json({ message: "User not found", data: {} });

                res.status(200).json({ message: "User updated", data: updatedUser });
            } catch (err) {
                res.status(500).json({ message: "Error updating user", data: err });
            }
        })
        .delete(async function (req, res) {
            try {
                const user = await User.findById(req.params.id);
                if (!user)
                    return res.status(404).json({ message: "User not found", data: {} });

                await Task.updateMany(
                    { assignedUser: req.params.id },
                    { assignedUser: "", assignedUserName: "unassigned" }
                );

                await User.findByIdAndDelete(req.params.id);
                res.status(200).json({ message: "User deleted", data: {} });
            } catch (err) {
                res.status(500).json({ message: "Error deleting user", data: err });
            }
        });

    return router;
};
