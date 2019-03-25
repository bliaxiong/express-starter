
let crypto
const async = require('neo-async')
const passport = require('passport')

const UserRepo = require('../repositories/UserRepository.js')
const emailService = require('../services/emailService.js')


exports.getLogin = (req, res) => {
  if (req.user) { return res.redirect('/account') }

  res.render('account/login', {
    title: 'Login',
  })
}

exports.postLogin = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password cannot be blank').notEmpty()

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/login')
  }

  passport.authenticate('local', (err, user, info) => {
    if (!user || err) {
      req.flash('errors', { msg: err || info.message })
      return res.redirect('/login')
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr)
      req.flash('success', { msg: 'Success! You are logged in.' })
      const redirectTo = req.session.returnTo || '/';
      delete req.session.returnTo
      res.redirect(redirectTo)
    })
  })(req, res, next)
}

exports.logout = (req, res) => {
  req.logout()
  res.locals.user = null
  res.render('home', {
    title: 'Home',
  })
}

exports.getSignup = (req, res) => {
  if (req.user) return res.redirect('/')
  res.render('account/signup', {
    title: 'Create Account',
  })
}

exports.postSignup = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password must be at least 4 characters long').len(4)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/signup')
  }

  UserRepo.createUser({
    email: req.body.email,
    password: req.body.password,
    profile: {},
    tokens: {},
  })
    .then((user) => {
      req.logIn(user, (err) => {
        if (err) return next(err)
        req.flash('success', { msg: 'Your account has been created and you\'ve been logged in.' })
        res.redirect('/')
      })
    })
    .catch((err) => {
      req.flash('errors', { msg: err })
      return res.redirect('/login')
    })
}

exports.getAccount = (req, res) => {
  res.render('account/profile', {
    title: 'Account Management',
  })
}

exports.postUpdateProfile = (req, res) => {
  req.assert('email', 'Email is not valid').isEmail()

  UserRepo.changeProfileData(req.user.id, req.body)
    .then(() => {
      req.flash('success', { msg: 'Profile information updated.' })
      res.redirect('/account')
    })
    .catch((err) => {
      req.flash('errors', { msg: err })
      res.redirect('/account')
    })
}

exports.postUpdatePassword = (req, res) => {
  req.assert('password', 'Password must be at least 4 characters long').len(4)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/account')
  }

  UserRepo.changeUserPassword(req.user.id, req.body.password)
    .then(() => {
      req.flash('success', { msg: 'Password has been changed.' })
      res.redirect('/account')
    })
    .catch((err) => {
      req.flash('errors', { msg: err })
      res.redirect('/account')
    })
}

exports.deleteAccount = (req, res) => {
  UserRepo.removeUserById(req.user.id)
    .then(() => {
      req.logout()
      req.flash('info', { msg: 'Your account has been deleted.' })
      res.json({ success: true })
    })
}

exports.getOauthUnlink = (req, res, next) => {
  const { provider } = req.params

  UserRepo.unlinkProviderFromAccount(provider, req.user.id)
    .then(() => {
      req.flash('info', { msg: `${provider} account has been unlinked.` })
      res.redirect('/account')
    })
    .catch(err => next(err))
}

exports.getReset = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }

  UserRepo.findUserByResetPswToken(req.params.token)
    .then((user) => {
      if (!user) { throw 'Password reset request is invalid or has expired.' }

      res.render('account/reset', {
        title: 'Password Reset',
      })
    })
    .catch((err) => {
      req.flash('errors', { msg: err })
      return res.redirect('/forgot')
    })
}

exports.postReset = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long.').len(4)
  req.assert('confirm', 'Passwords must match.').equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('back')
  }

  async.waterfall([
    (done) => {
      UserRepo.changeUserPswAndResetToken(req.params.token, req.body.password)
        .then((user) => {
          req.logIn(user, (err2) => {
            done(err2, user)
          })
        })
        .catch((err) => { done(err, null) })
    },
    (user, done) => {
      emailService.sendPasswordChangeNotificationEmail(user.email, (err) => {
        req.flash('info', {
          msg: `Password has been successfully changed. Notification e-mail has been sent to ${user.email} to inform about this fact.`,
        })
        done(err, 'done')
      })
    },
  ], (err) => {
    if (err) return next(err)
    res.redirect('/')
  })
}

exports.getForgot = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  res.render('account/forgot', {
    title: 'Forgot Password',
  })
}

exports.postForgot = (req, res, next) => {
  crypto = require('crypto')

  req.assert('email', 'Please enter a valid email address.').isEmail()
  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/forgot')
  }

  async.waterfall([
    (done) => {
      crypto.randomBytes(24, (err, buf) => {
        const token = buf.toString('hex')
        done(err, token)
      })
    },
    (token, done) => {
      const email = req.body.email.toLowerCase()
      UserRepo.assignResetPswToken(email, token)
        .then((user) => {
          done(null, token, user)
        })
        .catch((err) => {
          req.flash('errors', { msg: err })
          return res.redirect('/forgot')
        })
    },
    (token, user, done) => {
      emailService.sendRequestPasswordEmail(user.email, req.headers.host, token, (err) => {
        req.flash('info', { msg: `An e-mail has been sent to ${user.email} with further instructions.` })
        done(err, 'done')
      })
    },
  ], (err) => {
    if (err) return next(err)
    res.redirect('/forgot')
  })
}
