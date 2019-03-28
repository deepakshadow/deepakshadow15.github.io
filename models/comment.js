const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let commentSchema = new Schema(
    {
        text: String,
        author: {
            id: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            username: String
        }
    }
);

module.exports = mongoose.model('Comment', commentSchema);