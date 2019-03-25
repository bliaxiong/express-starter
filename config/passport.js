const passport = require('passport')
const Promise = require('bluebird')
const LocalStrategy = require('passport-local').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const TwitterStrategy = require('passport-twitter').Strategy
const GitHubStrategy = require('passport-github').Strategy
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy

const secrets = require('./secrets')
const db = require('../models/sequelize')
const UserRepo = require('../repositories/UserRepository')

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser((id, done) => {
  db.User.findById(id).then((user) => {
    done(null, user)
  }).catch((error) => {
    done(error)
  })
})

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, ((email, password, done) => {
  email = email.toLowerCase()
  db.User.findUser(email, password, (err, user) => {
    if (err) { return done(err, null) }
    return done(null, user)
  })
})))

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy(secrets.facebook, ((req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    UserRepo.linkFacebookProfile(req.user.id, accessToken, refreshToken, profile)
      .then((user) => {
        req.flash('info', { msg: 'Facebook account has been linked.' })
        done(null, user)
      })
      .catch((err) => {
        req.flash('errors', { msg: err })
        done(null, false, { message: err })
      })
  } else {
    UserRepo.createAccFromFacebook(accessToken, refreshToken, profile)
      .then((user) => { done(null, user) })
      .catch((error) => { done(error) })
  }
})))

/**
 * Sign in with GitHub.
 */
passport.use(new GitHubStrategy(secrets.github, ((req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    UserRepo.linkGithubProfile(req.user.id, accessToken, refreshToken, profile)
      .then((user) => {
        req.flash('info', { msg: 'GitHub account has been linked.' })
        done(null, user)
      })
      .catch((err) => {
        req.flash('errors', { msg: err })
        done(null, false, { message: err })
      })
  } else {
    UserRepo.createAccFromGithub(accessToken, refreshToken, profile)
      .then((user) => { done(null, user) })
      .catch((error) => { done(error) })
  }
})))

/**
 * Sign in with Twitter.
 */
passport.use(new TwitterStrategy(secrets.twitter, ((req, accessToken, tokenSecret, profile, done) => {
  if (req.user) {
    UserRepo.linkTwitterProfile(req.user.id, accessToken, tokenSecret, profile)
      .then((user) => {
        req.flash('info', { msg: 'Twitter account has been linked.' })
        done(null, user)
      })
      .catch((err) => {
        req.flash('errors', { msg: err })
        done(null, false, { message: err })
      })
  } else {
    UserRepo.createAccFromTwitter(accessToken, tokenSecret, profile)
      .then((user) => { done(null, user) })
      .catch((error) => { done(error) })
  }
})))

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy(secrets.google, ((req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    UserRepo.linkGoogleProfile(req.user.id, accessToken, refreshToken, profile)
      .then((user) => {
        req.flash('info', { msg: 'Google account has been linked.' })
        done(null, user)
      })
      .catch((err) => {
        req.flash('errors', { msg: err })
        done(null, false, { message: err })
      })
  } else {
    UserRepo.createAccFromGoogle(accessToken, refreshToken, profile)
      .then((user) => { done(null, user) })
      .catch((error) => { done(error) })
  }
})))

/**
 * Sign in with LinkedIn.
 */
passport.use(new LinkedInStrategy(secrets.linkedin, ((req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    UserRepo.linkLinkedInProfile(req.user.id, accessToken, refreshToken, profile)
      .then((user) => {
        req.flash('info', { msg: 'LinkedIn account has been linked.' })
        done(null, user)
      })
      .catch((err) => {
        req.flash('errors', { msg: err })
        done(null, false, { message: err })
      })
  } else {
    UserRepo.createAccFromLinkedIn(accessToken, refreshToken, profile)
      .then((user) => { done(null, user) })
      .catch((error) => { done(error) })
  }
})))

/**
 * Login Required middleware.
 */
exports.isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect('/login')
}

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = function (req, res, next) {
  const provider = req.path.split('/').slice(-1)[0]

  if (req.user.tokens[provider]) {
    next()
  } else {
    res.redirect(`/auth/${provider}`)
  }
}
