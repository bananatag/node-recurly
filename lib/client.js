(function () {
  'use strict';
  var request = require('request'),
    pjson = require('../package.json'),
    Xml2js = require('xml2js'),
    parser = new Xml2js.Parser({explicitArray: false});

  exports.create = function (config) {
    config.RECURLY_HOST = config.SUBDOMAIN + '.recurly.com';
    const proxyOptions = {
      PROXY                       : "proxy",
      STRICT_SSL                  : "strictSSL",
      TUNNEL                      : "tunnel",
      PROXY_HEADER_WHITE_LIST     : "proxyHeaderWhiteList",
      PROXY_HEADER_EXCLUSIVE_LIST : "proxyHeaderExclusiveList"
    };
    const baseUrl = 'https://' + config.RECURLY_HOST;

    return {

      request: function (route, callback, data) {
        var endpoint = route[0];
        var method = route[1];
        var that = this;

        var headers = {
          Authorization: "Basic " + (new Buffer(config.API_KEY)).toString('base64'),
          Accept: 'application/xml',
          'Content-Length': (data) ? data.length : 0,
          'User-Agent': "node-recurly/" + pjson.version
        };

        var options = {
          headers : headers,
          method  : method,
          baseUrl : baseUrl,
          uri     : endpoint
        };

        for (var key in proxyOptions) {
          if(typeof config[key] !== 'undefined') {
            options[proxyOptions[key]] = config[key];
          }
        }

        if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
          options.headers['Content-Type'] = 'application/xml';
          that.debug(data);
        }
        that.debug(options);

        request(options, function(err, res, body) {
          if (err) {
            return _cb(null, err);
          }

          that.debug('Response is: ' + res.statusCode);
          that.debug(body);
          try {
            // 200–299 success
            if (res.statusCode >= 200 && res.statusCode <= 299) {
              if (body === '') {
                return _cb(res);
              }
              return parser.parseString(body, function (err, result) {
                return _cb(res, null, result);
              });
            }
            // 400–499 client request errors
            // 500–599 server errors
            if ([404, 412, 422, 500].indexOf(res.statusCode) !== -1) {
              return parser.parseString(body, function (err, result) {
                return _cb(res, result);
              });
            }
            if (res.statusCode >= 400) {
              return _cb(res, body);
            }
          }
          catch (e) {
            return _cb(null, e);
          }
        });

        // fallback for backward compatibility
        function _cb(res, err, data) {
          // callback objects acquired from parent scope
          if (typeof callback === 'undefined') {
            throw new Error('Missing argument: callback function');
          }
          if (typeof callback !== 'function') {
            throw new Error('Callback should be a function');
          }
          if (callback.length === 2) {
            if (err) {
              return callback(_wrap_response(res, err));
            }
            return callback(null, _wrap_response(res, data));

          }
          // backward compatibility for not node.js style callbacks
          // TBD: skip in next version?
          else if (callback.length === 1) {
            var toreturn = {status: 'ok', data: '', headers: res ? res.headers : null };
            if (err) {
              toreturn.status = 'error';
              if (!res || err === Error || err instanceof Error) {
                toreturn.description = err;
              } else if (res.statusCode >= 400) {
                toreturn.data = res.statusCode;
                toreturn.additional = err;
              } else {
                toreturn.data = err;
              }
              return callback(toreturn);
            }
            toreturn.data = data;
            toreturn.description = res.statusCode;
            return callback(toreturn);
          }
        }

        function _wrap_response(res, data) {
          if (!res) {
            return {data: data && data.stack ? data.stack : data};
          }
          return {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          };
        }
      },

      debug: function (s) {
        if (config.DEBUG) {
          console.log(s);
        }
      },

      trim: function (str) {
        str = str.replace(/^\s+/, '');
        for (var i = str.length - 1; i >= 0; i--) {
          if (/\S/.test(str.charAt(i))) {
            str = str.substring(0, i + 1);
            break;
          }
        }
        return str;
      }

    };
  };

})();
