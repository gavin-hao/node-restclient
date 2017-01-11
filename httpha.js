/**
 * Created by zhigang on 14/10/27.
 */
"use strict";
var util = require('util');
var http = require('http');

/* {{{ function _extend() */
var _extend = function (a, b) {
    a = a || {};
    for (var i in b) {
        if (undefined !== b[i]) {
            a[i] = b[i];
        }
    }
    return a;
};
/* }}} */
exports.create = function (options, helper) {
    var _options = _extend({
        'interval': [5000, 90000]
    }, options);
    if (!Array.isArray(_options.interval)) {
        _options.interval = String(_options.interval).split(',');
    }
    for (var i = 0; i < _options.interval.length; i++) {
        _options.interval[i] = parseInt(_options.interval[i], 10) || 0;
    }
    _options.interval.sort(function (x, y) {
        return x - y;
    });
    if (!_options.interval[0] || _options.interval[0] < 1) {
        _options.interval[0] = 5000;
    }
    if (!_options.interval[1]) {
        _options.interval[1] = 16 * _options.interval[0];
    }
    var _backup = [];
    var _online = [];
    var _reqnum = -1;
    /* {{{ function _modifyInterval() */
    var _interval = _options.interval[0];
    var _modifyInterval = function (method) {
        if ('+' === method && _interval < _options.interval[1]) {
            _interval = Math.min(_options.interval[1], 2 * _interval);
        } else if ('-' === method && _interval > _options.interval[0]) {
            _interval = Math.max(_options.interval[0], parseInt(_interval / 2, 10));
        }
    };
    /* }}} */
    /* {{{ function heartbeat() */
    var heartbeat = null;
    if ('function' === (typeof helper)) {
        heartbeat = function (one) {
            var arg = Array.prototype.slice.call(arguments);
            var pos = _online.indexOf(one);
            arg.push(function (err, yes) {
                if (err) {
                    console.error(err.message);
                    //util.debug(err);

                }
                if (yes && pos < 0) {
                    _online.push(one);
                } else if (!yes && pos > -1) {
                    _online = _online.filter(function (x, p) {
                        return p !== pos;
                    });
                }
                setTimeout(function () {
                    heartbeat(one);
                }, _interval);
                _modifyInterval('+');
            });
            helper.apply(null, arg);
        };
    }
    /* }}} */
    var _me = {};
    _me.add = function (one) {
        _backup.push(one);
        if (heartbeat) {
            heartbeat(one);
        }
    };
    _me.fetch = function () {
        _reqnum++;
        _modifyInterval('-');
        if (_online.length > 0) {
            return _online[_reqnum % _online.length];
        }
        if (_backup.length > 0) {
            return _backup[_reqnum % _backup.length];
        }
        throw new Error('EmptyServerListException');
    };
    return _me;
};
exports.httpStatusChecker = function (request, options) {
    request = String(request).trim();
    if ('/' !== request.substring(0, 1)) {
        request = '/' + request;
    }
    var configs = _extend({
        'timeout': 1000,
        'useragent': 'HttpHA/0.1.0'
    }, options);
    return function (one, done) {
        var tmo = null;
        var has = false;
        var callback = function () {
            if (false === has) {
                has = true;
                done.apply(null, arguments);
            }
        };
        var req = http.request(_extend(_extend({}, one), {
            'method': 'HEAD',
            'path': request,
            'headers': {
                'User-Agent': configs.useragent
            }
        }), function (res) {

            var ret = res.statusCode - 0;
            callback(null, ret >= 200 && ret < 300);
        });
        req.on('socket', function (socket) {
            socket.setTimeout(configs.timeout);
            socket.on('timeout', function () {
                req.abort();
            });
        });
        req.on('error', function (err) {
            if (err.code === "ECONNRESET") {
                var err = new Error('HeartBeat request "' + request + '[host:' + req._headers.host + ']" timeout after ' + configs.timeout + 'ms');
                err.name = 'RequestTimeout';
                callback(err);
            }
            else{
                var error = new Error('HeartBeat request "' + request + '[' + req._headers.host + '] '+err.message , err);
                err.name = 'ConnectRefused';
                callback(error);
            }
        });
        req.end();
    };
};