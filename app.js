const http = require('http');
const fs = require('fs');
const appConfig = require('./config/appConfig');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const passport = require('passport');
const localStrategy = require('passport-local');
const passportLocalMongoose = require('passport-local-mongoose');
const methodOverride = require('method-override');
const flash = require('connect-flash');

// custom modles
const Campground = require('./models/campground');
const Comment = require('./models/comment');
const User = require('./models/user');

// instance of express
const app = express();
// middlewares
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(flash());

// passport instances
app.use(require('express-session')(
    {
        secret: 'yelpcamp local version',
        resave: false,
        saveUninitialized: false
    }
));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// custom middlewares
// data to fetch local places
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next;
});
// isLoggedIn
let isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'You need to logged in to do that');
    res.redirect('/login');
}

// check campground ownership
let checkCampOwnership = (req, res, next) => {
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id, (err, campground) => {
            if (err) {
                req.flash('error', 'some error occured');
                res.redirect('back');
            } else {
                if (campground.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash('error', 'you are not allowed to do that')
                    res.redirect('back');
                }
            }
        })
    } else {
        req.flash('error', 'You need to logged in to do that');
        res.redirect('back');
    }
}
// check comment ownership
let checkCommentOwnership = (req, res, next) => {
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, (err, comment) => {
            if (err) {
                req.flash('error', 'some error occured at checkownership level');
                res.redirect('back');
            } else {
                if (comment.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash('error', 'you are not allowed to do that');
                    res.redirect('back');
                }
            }
        })
    } else {
        req.flash('error', 'you need to logged in to do that');
        res.redirect('back');
    }
}

// route section
app.get('/', (req, res) => {
    res.render('home');
});

app.get('/campgrounds', (req, res) => {
    Campground.find({}, (err, result) => {
        if (err) {
            req.flash('error', 'no campgrounds found');
            console.log(err);
        } else {
            res.render('campgrounds', {campgrounds: result});
        }
    })
});

//create campground
app.get('/campgrounds/new', isLoggedIn, (req, res) => {
    res.render('newCamp');
});

app.post('/campgrounds', isLoggedIn, (req, res) => {
    Campground.create(req.body.campground, (err, result) => {
        if (err) {
            req.flash('error', 'something went wrong');
            console.log(err);
        } else {
            result.author.id = req.user._id;
            result.author.username = req.user.username;
            result.save();
            req.flash('success', 'campground added successfully');
            res.redirect('/campgrounds');
        }
    });
});

// single campground show page
app.get('/campgrounds/:id', (req, res) => {
    Campground.findById(req.params.id).populate('comments').exec((err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.render('show', {campground: result});
        }
    });
});

// edit campground
app.get('/campgrounds/:id/edit', checkCampOwnership, (req, res) => {
    Campground.findById(req.params.id, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.render('edit', {campground: result});
        }
    });
});

// edit page redirect
app.put('/campgrounds/:id', checkCampOwnership, (req, res) => {
    Campground.findByIdAndUpdate(req.params.id, req.body.campground).exec((err, result) => {
        if (err) {
            req.flash('error', 'something went wrong');
            console.log(err);
        } else {
            req.flash('success', 'campground edited successfully');
            res.redirect('/campgrounds/' + req.params.id);
        }
    });
});

// delete campground
app.delete('/campgrounds/:id', checkCampOwnership, (req, res) => {
    Campground.findByIdAndRemove(req.params.id, (err, result) => {
        if (err) {
            res.redirect('back');
        } else {
            req.flash('success', 'Campground deleted successfully');
            res.redirect('/campgrounds');
        }
    });
});
// comment page
app.get('/campgrounds/:id/comments/new', isLoggedIn, (req, res) => {
    Campground.findById(req.params.id, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.render('newComment', {campground: result});
        }
    });
});

// comment post page
app.post('/campground/:id/comments', isLoggedIn, (req, res) => {
    Campground.findById(req.params.id, (err, result) => {
        if (err) {
            req.flash('error', 'something went wrong');
            console.log(err);
        } else {
            Comment.create(req.body.comment, (err, commentResult) => {
                if (err) {
                    console.log(err);
                } else {
                    // adding author for user convention
                    commentResult.author.id = req.user._id;
                    commentResult.author.username = req.user.username;
                    commentResult.save();
                    result.comments.push(commentResult);
                    result.save();
                    req.flash('success', 'comment added successfully');
                    res.redirect('/campgrounds/' + result._id);
                }
            });
        }
    });
});

// comment edit
app.get('/campgrounds/:id/comments/:comment_id/edit', checkCommentOwnership, (req, res) => {
    Campground.findById(req.params.id, (err, campground) => {
        if (err) {
            res.redirect('back');
        } else {
            Comment.findById(req.params.comment_id, (err, comment) => {
                if (err) {
                    res.redirect('back');
                } else {
                    res.render('commentEdit', {campground: campground, comment: comment});
                }
            });
        }
    });
});

// comment edit post page
app.put('/campgrounds/:id/comments/comment_id', checkCommentOwnership, (req, res) => {
    Campground.findById(req.params.id, (err, campground) => {
        if (err) {
            res.redirect('back');
        } else {
            Comment.findByIdAndUpdate(req.params.comment_id, (err, comment) => {
                if (err) {
                    res.redirect('back');
                } else {
                    req.flash('success', 'comment edited successfully');
                    res.redirect('/campgrounds/' + req.params.id);
                }
            });
        }
    });
});

// delete comment
app.delete('/campgrounds/:id/comments/:comment_id', checkCommentOwnership, (req, res) => {
    Campground.findById(req.params.id, (err, campground) => {
        if (err) {
            res.redirect('back');
        } else {
            Comment.findByIdAndRemove(req.params.comment_id, (err, comment) => {
                if (err) {
                    res.redirect('back');
                } else {
                    req.flash('success', 'comment deleted successfully');
                    res.redirect('/campgrounds/' + req.params.id);
                }
            });
        }
    });
});

// authentication process
// register
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    User.register(new User({username: req.body.username}), req.body.password, (err, result) => {
        if (err) {
            req.flash('error', err.message);
            res.redirect('/register');
        } else {
            passport.authenticate('local')(req, res, () => {
                req.flash('success', 'Welcome To Yelpcamp ' + user.username);
                res.redirect('/campgrounds');
            });
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/campgrounds',
    failureRedirect: '/login'
}), (req, res) => {
    //
});

app.get('/logout', (req, res) => {
    req.logout();
    req.flash('success', 'Logged you out');
    res.redirect('/login');
})


// server listening department
/**
 * create HHTP server
 */
const server = http.createServer(app);
// start listening to the http server
console.log(appConfig);
server.listen(appConfig.port);
server.on('error', onError);
server.on('listening', onListening);
// end server listening code 

/**
 * Event listener for HTTP server 'error' event
 */
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            process.exit(1);
            break;
        case 'EADDRINUSE':
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event Listener for HTTP server 'listening' event
 */

 function onListening() {
     var addr = server.address();
     var bind = (typeof addr === 'string') ? 'pipe' + addr: 'port' + addr.port;
     ('Listening on ' + bind);
     let db = mongoose.connect(appConfig.db.uri, {useNewUrlParser: true});
 }

process.on('unhandledRejection', (reason, p) => {
    console.log('unhandled rejection at: promise', p, 'reason:', reason);
    // application specific loggiing, throwing an error, or other logic here
})

//database connection section
//mongoose connection error event
mongoose.connection.on('error', function(err) {
    console.log('database connection error!!!');
    console.log(err);
}); // end mongoose connection error
mongoose.connection.on('open', function(err) {
    if (err) {
        console.log(`connection error`);
        console.log(err);
    } else {
        console.log(`database open connection success`);
    }
}); // end to open connection event