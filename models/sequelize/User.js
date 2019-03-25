
const bcrypt = require('bcrypt-nodejs')
const crypto = require('crypto')

// HMAC version
// var secrets = require('../config/secrets')
// function createHash(string) {
//   if(!string)
//     return null

//   var hashKey = secrets.localAuth.hashKey
//   var hmac = crypto.createHmac(secrets.localAuth.hashMethod, new Buffer(hashKey, 'utf-8'))
//   return hmac.update(new Buffer(string, 'utf-8')).digest('hex')
// }

const instanceMethods = {
  getGravatarUrl(size) {
    if (!size) size = 200

    if (!this.email) {
      return `https://gravatar.com/avatar/?s=${size}&d=retro`
    }

    const md5 = crypto.createHash('md5').update(this.email).digest('hex')
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`
  },
  getProfilePicture(size) {
    if (this.profile && this.profile.picture != null) { return this.profile.picture }

    return this.getGravatarUrl(size)
  },
  hasSetPassword() {
    return this.password != null && this.password.length > 0
  },
}

const beforeSaveHook = (user, options, fn) => {
  if (user.changed('password')) {
    this.encryptPassword(user.password, (hash, err) => {
      user.password = hash
      fn(null, user)
    })
    return
  }
  fn(null, user)
}

module.exports = (db, DataTypes) => {
  const User = db.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    password: DataTypes.STRING,
    googleId: {
      type: DataTypes.STRING,
      unique: true,
    },
    facebookId: {
      type: DataTypes.STRING,
      unique: true,
    },
    twitterId: {
      type: DataTypes.STRING,
      unique: true,
    },
    linkedInId: {
      type: DataTypes.STRING,
      unique: true,
    },
    githubId: {
      type: DataTypes.STRING,
      unique: true,
    },
    resetPasswordExpires: DataTypes.DATE,
    resetPasswordToken: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    logins: DataTypes.INTEGER,
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      isEmail: true,
    },
    profile: DataTypes.JSON,
    tokens: DataTypes.JSON,
  }, {
    tableName: 'pl_users',
    instanceMethods,
    classMethods: {
      associate(models) {
        // User.hasMany(models.Role)
      },
      encryptPassword(password, cb) {
        if (!password) {
          cb('', null)
          return
        }

        bcrypt.genSalt(10, (err, salt) => {
          if (err) {
            cb(null, err)
            return
          }
          bcrypt.hash(password, salt, null, (hErr, hash) => {
            if (hErr) {
              cb(null, hErr)
              return
            }
            cb(hash, null)
          })
        })
      },
      findUser(email, password, cb) {
        User.findOne({
          where: { email },
        })
          .then((user) => {
            if (user == null || user.password == null || user.password.length === 0) {
              cb('User / Password combination is not correct', null)
              return
            }
            bcrypt.compare(password, user.password, (err, res) => {
              if (res) {
                cb(null, user)
              } else {
                cb(err, null)
              }
            })
          })
          .catch((serr) => { cb(serr, null) })
      },
    },
    hooks: {
      beforeUpdate: beforeSaveHook,
      beforeCreate: beforeSaveHook,
    },
    indexes: [
      {
        name: 'facebookIdIndex',
        method: 'BTREE',
        fields: ['facebookId'],
      },
      {
        name: 'googleIdIndex',
        method: 'BTREE',
        fields: ['googleId'],
      },
      {
        name: 'twitterIdIndex',
        method: 'BTREE',
        fields: ['twitterId'],
      },
      {
        name: 'linkedInIdIndex',
        method: 'BTREE',
        fields: ['linkedInId'],
      },
      {
        name: 'githubIdIndex',
        method: 'BTREE',
        fields: ['githubId'],
      },
    ],
  })

  return User
}
