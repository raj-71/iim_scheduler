const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        lowercase: true,
        unique: true,
        required: [true, "can't be blank"],
        index: true,
    },
    first_name: {
        type: String,
        required: false,
    },
    last_name: {
        type: String,
        required: false,
    },
    username: {
        type: String,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now(),
    },
    courses: [
        {
            courseName: {
                type: String,
            },
            section: {
                type: String,
                default: "",
            },
        },
    ],
});

module.exports = mongoose.model("Term5", userSchema);
