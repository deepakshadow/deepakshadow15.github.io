const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let campgroundSchema = new Schema(
    {
        title: String,
        image: String,
        description: String,
        price: String,
        author: {
            id: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            username: String
        },
        comments: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Comment'
            }
        ]
    }
);

module.exports = mongoose.model('Campground', campgroundSchema);