const querystring = require('querystring')
const validator = require('validator')
const async = require('neo-async')
const request = require('request')
const _ = require('lodash')
const secrets = require('../config/secrets')

// specific requires
let cheerio
let graph
let LastFmNode
let Github
let Twit
let stripe
let twilio
let Linkedin
let BitGo
let clockwork
let paypal
let lob
let Y

/**
 * GET /api
 * List of API examples.
 */
exports.getApi = (req, res) => {
  res.render('api/index', {
    title: 'API Examples',
  })
}

/**
 * GET /api/facebook
 * Facebook API example.
 */
exports.getFacebook = (req, res, next) => {
  graph = require('fbgraph')

  const token = req.user.tokens.facebook
  graph.setAccessToken(token)
  async.parallel({
    getMe(done) {
      graph.get(req.user.facebookId, (err, me) => {
        done(err, me)
      })
    },
    getMyFriends(done) {
      graph.get(`${req.user.facebookId}/friends`, (err, friends) => {
        done(err, friends.data)
      })
    },
  },
  (err, results) => {
    if (err) return next(err)
    res.render('api/facebook', {
      title: 'Facebook API',
      me: results.getMe,
      friends: results.getMyFriends,
    })
  })
}

/**
 * GET /api/scraping
 * Web scraping example using Cheerio library.
 */
exports.getScraping = (req, res, next) => {
  cheerio = require('cheerio')

  request.get('https://news.ycombinator.com/', (err, reqInner, body) => {
    if (err) return next(err)
    const $ = cheerio.load(body)
    const links = []
    $('.title a[href^="http"], a[href^="https"]').each(() => {
      links.push($(this))
    })
    res.render('api/scraping', {
      title: 'Web Scraping',
      links,
    })
  })
}

/**
 * GET /api/github
 * GitHub API Example.
 */
exports.getGithub = (req, res, next) => {
  Github = require('github-api')

  const token = req.user.tokens.github
  const github = new Github({ token })
  const repo = github.getRepo('sahat', 'requirejs-library')
  repo.show((err, repository) => {
    if (err) return next(err)
    res.render('api/github', {
      title: 'GitHub API',
      repo: repository,
    })
  })
}

/**
 * GET /api/aviary
 * Aviary image processing example.
 */
exports.getAviary = (req, res) => {
  res.render('api/aviary', {
    title: 'Aviary API',
  })
}

/**
 * GET /api/nyt
 * New York Times API example.
 */
exports.getNewYorkTimes = (req, res, next) => {
  const query = querystring.stringify({ 'api-key': secrets.nyt.key, 'list-name': 'young-adult' })
  const url = `http://api.nytimes.com/svc/books/v2/lists?${query}`
  request.get(url, (err, reqInner, body) => {
    if (err) return next(err)
    if (reqInner.statusCode === 403) return next(Error('Missing or Invalid New York Times API Key'))
    const bestsellers = JSON.parse(body)
    res.render('api/nyt', {
      title: 'New York Times API',
      books: bestsellers.results,
    })
  })
}

/**
 * GET /api/lastfm
 * Last.fm API example.
 */
exports.getLastfm = (req, res, next) => {
  LastFmNode = require('lastfm').LastFmNode

  const lastfm = new LastFmNode(secrets.lastfm)
  async.parallel({
    artistInfo(done) {
      lastfm.request('artist.getInfo', {
        artist: 'The Pierces',
        handlers: {
          success(data) {
            done(null, data)
          },
          error(err) {
            done(err)
          },
        },
      })
    },
    artistTopTracks(done) {
      lastfm.request('artist.getTopTracks', {
        artist: 'The Pierces',
        handlers: {
          success(data) {
            const tracks = []
            _.each(data.toptracks.track, (track) => {
              tracks.push(track)
            })
            done(null, tracks.slice(0, 10))
          },
          error(err) {
            done(err)
          },
        },
      })
    },
    artistTopAlbums(done) {
      lastfm.request('artist.getTopAlbums', {
        artist: 'The Pierces',
        handlers: {
          success(data) {
            const albums = []
            _.each(data.topalbums.album, (album) => {
              albums.push(album.image.slice(-1)[0]['#text'])
            })
            done(null, albums.slice(0, 4))
          },
          error(err) {
            done(err)
          },
        },
      })
    },
  },
  (err, results) => {
    if (err) return next(err.error.message)
    const artist = {
      name: results.artistInfo.artist.name,
      image: results.artistInfo.artist.image.slice(-1)[0]['#text'],
      tags: results.artistInfo.artist.tags.tag,
      bio: results.artistInfo.artist.bio.summary,
      stats: results.artistInfo.artist.stats,
      similar: results.artistInfo.artist.similar.artist,
      topAlbums: results.artistTopAlbums,
      topTracks: results.artistTopTracks,
    }
    res.render('api/lastfm', {
      title: 'Last.fm API',
      artist,
    })
  })
}

/**
 * GET /api/twitter
 * Twiter API example.
 */
exports.getTwitter = (req, res, next) => {
  Twit = require('twit')

  const accessToken = req.user.tokens.twitter
  const secretToken = req.user.tokens.twitterSecret
  const T = new Twit({
    consumer_key: secrets.twitter.consumerKey,
    consumer_secret: secrets.twitter.consumerSecret,
    access_token: accessToken,
    access_token_secret: secretToken,
  })
  T.get('search/tweets', { q: 'nodejs since:2013-01-01', geocode: '40.71448,-74.00598,5mi', count: 10 }, (err, reply) => {
    if (err) return next(err)
    res.render('api/twitter', {
      title: 'Twitter API',
      tweets: reply.statuses,
    })
  })
}

/**
 * POST /api/twitter
 * Post a tweet.
 */
exports.postTwitter = (req, res, next) => {
  Twit = require('twit')

  req.assert('tweet', 'Tweet cannot be empty.').notEmpty()
  const errors = req.validationErrors()
  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/api/twitter')
  }
  const accessToken = req.user.tokens.twitter
  const secretToken = req.user.tokens.twitterSecret
  const T = new Twit({
    consumer_key: secrets.twitter.consumerKey,
    consumer_secret: secrets.twitter.consumerSecret,
    access_token: accessToken,
    access_token_secret: secretToken,
  })
  T.post('statuses/update', { status: req.body.tweet }, (err) => {
    if (err) return next(err)
    req.flash('success', { msg: 'Tweet has been posted.' })
    res.redirect('/api/twitter')
  })
}

/**
 * GET /api/steam
 * Steam API example.
 */
exports.getSteam = (req, res, next) => {
  const steamId = '76561198040657099'
  const query = { l: 'english', steamid: steamId, key: secrets.steam.apiKey }
  async.parallel({
    playerAchievements(done) {
      query.appid = '49520'
      const qs = querystring.stringify(query)
      request.get({ url: `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?${qs}`, json: true }, (error, req1, body) => {
        if (req1.statusCode === 401) return done(new Error('Missing or Invalid Steam API Key'))
        done(error, body)
      })
    },
    playerSummaries(done) {
      query.steamids = steamId
      const qs = querystring.stringify(query)
      request.get({ url: `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${qs}`, json: true }, (err, req1, body) => {
        if (req1.statusCode === 401) return done(new Error('Missing or Invalid Steam API Key'))
        done(err, body)
      })
    },
    ownedGames(done) {
      query.include_appinfo = 1
      query.include_played_free_games = 1
      const qs = querystring.stringify(query)
      request.get({ url: `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${qs}`, json: true }, (err, req1, body) => {
        if (req1.statusCode === 401) return done(new Error('Missing or Invalid Steam API Key'))
        done(err, body)
      })
    },
  },
  (err, results) => {
    if (err) return next(err)
    res.render('api/steam', {
      title: 'Steam Web API',
      ownedGames: results.ownedGames.response.games,
      playerAchievemments: results.playerAchievements.playerstats,
      playerSummary: results.playerSummaries.response.players[0],
    })
  })
}

/**
 * GET /api/stripe
 * Stripe API example.
 */
exports.getStripe = (req, res) => {
  stripe = require('stripe')(secrets.stripe.secretKey)

  res.render('api/stripe', {
    title: 'Stripe API',
    publishableKey: secrets.stripe.publishableKey,
  })
}

/**
 * POST /api/stripe
 * Make a payment.
 */
exports.postStripe = (req, res, next) => {
  stripe = require('stripe')(secrets.stripe.secretKey)

  const { stripeToken } = req.body
  const { stripeEmail } = req.body
  stripe.charges.create({
    amount: 395,
    currency: 'usd',
    source: stripeToken,
    description: stripeEmail,
  }, (err) => {
    if (err && err.type === 'StripeCardError') {
      req.flash('errors', { msg: 'Your card has been declined.' })
      res.redirect('/api/stripe')
    }
    req.flash('success', { msg: 'Your card has been charged successfully.' })
    res.redirect('/api/stripe')
  })
}

/**
 * GET /api/twilio
 * Twilio API example.
 */
exports.getTwilio = (req, res) => {
  res.render('api/twilio', {
    title: 'Twilio API',
  })
}

/**
 * POST /api/twilio
 * Send a text message using Twilio.
 */
exports.postTwilio = (req, res, next) => {
  twilio = require('twilio')(secrets.twilio.sid, secrets.twilio.token)

  req.assert('number', 'Phone number is required.').notEmpty()
  req.assert('message', 'Message cannot be blank.').notEmpty()
  const errors = req.validationErrors()
  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/api/twilio')
  }
  const message = {
    to: req.body.number,
    from: '+13472235148',
    body: req.body.message,
  }
  twilio.sendMessage(message, (err, responseData) => {
    if (err) return next(err.message)
    req.flash('success', { msg: `Text sent to ${responseData.to}.` })
    res.redirect('/api/twilio')
  })
}

/**
 * GET /api/clockwork
 * Clockwork SMS API example.
 */
exports.getClockwork = (req, res) => {
  res.render('api/clockwork', {
    title: 'Clockwork SMS API',
  })
}

/**
 * POST /api/clockwork
 * Send a text message using Clockwork SMS
 */
exports.postClockwork = (req, res, next) => {
  clockwork = require('clockwork')({ key: secrets.clockwork.apiKey })

  const message = {
    To: req.body.telephone,
    From: 'Hackathon',
    Content: 'Hello from the Hackathon Starter',
  }
  clockwork.sendSms(message, (err, responseData) => {
    if (err) return next(err.errDesc)
    req.flash('success', { msg: `Text sent to ${responseData.responses[0].to}` })
    res.redirect('/api/clockwork')
  })
}

/**
 * GET /api/venmo
 * Venmo API example.
 */
exports.getVenmo = (req, res, next) => {
  const token = req.user.tokens.venmo
  const query = querystring.stringify({ access_token: token.accessToken })
  async.parallel({
    getProfile(done) {
      request.get({ url: `https://api.venmo.com/v1/me?${query}`, json: true }, (err, req1, body) => {
        done(err, body)
      })
    },
    getRecentPayments(done) {
      request.get({ url: `https://api.venmo.com/v1/payments?${query}`, json: true }, (err, req1, body) => {
        done(err, body)
      })
    },
  },
  (err, results) => {
    if (err) return next(err)
    res.render('api/venmo', {
      title: 'Venmo API',
      profile: results.getProfile.data,
      recentPayments: results.getRecentPayments.data,
    })
  })
}

/**
 * POST /api/venmo
 * Send money.
 */
exports.postVenmo = (req, res, next) => {
  req.assert('user', 'Phone, Email or Venmo User ID cannot be blank').notEmpty()
  req.assert('note', 'Please enter a message to accompany the payment').notEmpty()
  req.assert('amount', 'The amount you want to pay cannot be blank').notEmpty()
  const errors = req.validationErrors()
  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/api/venmo')
  }
  const token = req.user.tokens.venmo
  const formData = {
    access_token: token.accessToken,
    note: req.body.note,
    amount: req.body.amount,
  }
  if (validator.isEmail(req.body.user)) {
    formData.email = req.body.user
  } else if (validator.isNumeric(req.body.user)
    && validator.isLength(req.body.user, 10, 11)) {
    formData.phone = req.body.user
  } else {
    formData.user_id = req.body.user
  }
  request.post('https://api.venmo.com/v1/payments', { form: formData }, (err, req1, body) => {
    if (err) return next(err)
    if (req1.statusCode !== 200) {
      req.flash('errors', { msg: JSON.parse(body).error.message })
      return res.redirect('/api/venmo')
    }
    req.flash('success', { msg: 'Venmo money transfer complete' })
    res.redirect('/api/venmo')
  })
}

/**
 * GET /api/linkedin
 * LinkedIn API example.
 */
exports.getLinkedin = (req, res, next) => {
  Linkedin = require('node-linkedin')(secrets.linkedin.clientID, secrets.linkedin.clientSecret, secrets.linkedin.callbackURL)

  const token = req.user.tokens.linkedin
  const linkedin = Linkedin.init(token)
  linkedin.people.me((err, $in) => {
    if (err) return next(err)
    res.render('api/linkedin', {
      title: 'LinkedIn API',
      profile: $in,
    })
  })
}

/**
 * GET /api/yahoo
 * Yahoo API example.
 */
exports.getYahoo = (req, res) => {
  Y = require('yui/yql')

  Y.YQL('SELECT * FROM weather.forecast WHERE (location = 10007)', (response) => {
    const { location } = response.query.results.channel
    const { condition } = response.query.results.channel.item
    res.render('api/yahoo', {
      title: 'Yahoo API',
      location,
      condition,
    })
  })
}

/**
 * GET /api/paypal
 * PayPal SDK example.
 */
exports.getPayPal = (req, res, next) => {
  paypal = require('paypal-rest-sdk')

  paypal.configure({
    mode: 'sandbox',
    client_id: secrets.paypal.client_id,
    client_secret: secrets.paypal.client_secret,
  })

  const paymentDetails = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
    },
    redirect_urls: {
      return_url: secrets.paypal.returnUrl,
      cancel_url: secrets.paypal.cancelUrl,
    },
    transactions: [{
      description: 'Express Starter',
      amount: {
        currency: 'USD',
        total: '1.99',
      },
    }],
  }

  paypal.payment.create(paymentDetails, (err, payment) => {
    if (err) return next(err)
    req.session.paymentId = payment.id
    const { links } = payment
    for (let i = 0; i < links.length; i++) {
      if (links[i].rel === 'approval_url') {
        res.render('api/paypal', {
          approvalUrl: links[i].href,
          result: null,
          title: 'PayPal API',
        })
      }
    }
  })
}

/**
 * GET /api/paypal/success
 * PayPal SDK example.
 */
exports.getPayPalSuccess = (req, res) => {
  const { paymentId } = req.session
  const paymentDetails = { payer_id: req.query.PayerID }
  paypal.payment.execute(paymentId, paymentDetails, (err) => {
    if (err) {
      res.render('api/paypal', {
        result: true,
        success: false,
        title: 'PayPal API',
      })
    } else {
      res.render('api/paypal', {
        result: true,
        success: true,
        title: 'PayPal API',
      })
    }
  })
}

/**
 * GET /api/paypal/cancel
 * PayPal SDK example.
 */
exports.getPayPalCancel = (req, res) => {
  req.session.paymentId = null
  res.render('api/paypal', {
    result: true,
    canceled: true,
  })
}

/**
 * GET /api/lob
 * Lob API example.
 */
exports.getLob = (req, res, next) => {
  lob = require('lob')(secrets.lob.apiKey)

  lob.routes.list({
    zip_codes: ['10007'],
  }, (err, routes) => {
    if (err) return next(err)
    res.render('api/lob', {
      title: 'Lob API',
      routes: routes.data[0].routes,
    })
  })
}

/**
 * GET /api/bitgo
 * BitGo wallet example
 */
exports.getBitGo = (req, res, next) => {
  BitGo = require('bitgo')

  const bitgo = new BitGo.BitGo({ env: 'test', accessToken: secrets.bitgo.accessToken })
  const { walletId } = req.session // we use the session to store the walletid, but you should store it elsewhere
  const walletParameters = ['id', 'label', 'permissions', 'balance', 'confirmedBalance', 'unconfirmedSends', 'unconfirmedReceives']

  const renderWalletInfo = function (wId) {
    bitgo.wallets().get({ id: wId }, (err, walletRes) => {
      walletRes.createAddress({}, (err1, addressRes) => {
        walletRes.transactions({}, (err2, transactionsRes) => {
          res.render('api/bitgo', {
            title: 'BitGo API',
            wallet: walletRes.wallet,
            walletParameters,
            address: addressRes.address,
            transactions: transactionsRes.transactions,
          })
        })
      })
    })
  }

  if (walletId) {
    // wallet was created in the session already, just load it up
    renderWalletInfo(walletId)
  } else {
    bitgo.wallets().createWalletWithKeychains(
      {
        passphrase: req.sessionID, // change this!
        label: `wallet for session ${req.sessionID}`,
        backupXpub: 'xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU',
      },
      (err, res1) => {
        req.session.walletId = res1.wallet.wallet.id
        renderWalletInfo(req.session.walletId)
      },
    )
  }
}

/**
 * POST /api/bitgo
 * BitGo send coins example
 */
exports.postBitGo = (req, res, next) => {
  BitGo = require('bitgo')

  const bitgo = new BitGo.BitGo({ env: 'test', accessToken: secrets.bitgo.accessToken })
  const { walletId } = req.session // we use the session to store the walletid, but you should store it elsewhere
  const amount = parseInt(req.body.amount)

  try {
    bitgo.wallets().get({ id: walletId }, (err, wallet) => {
      wallet.sendCoins(
        { address: req.body.address, amount, walletPassphrase: req.sessionID },
        (e, result) => {
          if (e) {
            console.dir(e)
            req.flash('errors', { msg: e.message })
            return res.redirect('/api/bitgo')
          }
          req.flash('info', { msg: `txid: ${result.hash}, hex: ${result.tx}` })
          return res.redirect('/api/bitgo')
        },
      )
    })
  } catch (e) {
    req.flash('errors', { msg: e.message })
    return res.redirect('/api/bitgo')
  }
}
