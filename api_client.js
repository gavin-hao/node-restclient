/**
 * Created by zhigang on 14/10/27.
 */
var httpha = require('./httpha.js');
var requestor = require('request');
var querystring = require('querystring');
var _ = require('lodash');
//var defaultConfig = require('./config-simple.json');
var config = require('config');
var format = require('util').format;

/*configs ----------
 {"service": {
 "servers": [
 {
 "name": "roshanApi",
 "hosts": ["localhost:5001"]
 },
 {
 "name": "orderApi",
 "hosts": ["localhost:4001"]
 }
 ]
 }
 }
 ----------------------*/
function createHA() {
    var ha = httpha.create({
        'interval': [10000]
    }, httpha.httpStatusChecker('/status', {
        'timeout': 1000
    }));
    return ha;
}
 function deepExtend(p, c) {
    self = this;
    var c = c || {};
    for (var i in p) {
        if (typeof  p[i] === 'object') {
            c[i] = (p[i].constructor == Array) ? [] : {};
            this.deepExtend(p[i], c[i]);
        } else {
            c[i] = p[i];
        }
    }
    return c;
};
var servers = (function () {
    var _servers = {};
    var conf = config.get('service');

    var _i = function () {
        var _options = _.defaults({}, conf.servers);
        init(_options);
        if (conf) {
            conf.on('changed', function (config) {
                //reload when config changed
                reload(config);
            });
        }
        function init(options) {
            var serHosts = null;
            if (_.isArray(options))
                serHosts = options;
            var serHosts = _.toArray(options);
            if (serHosts.length < 1) {
                throw new Error('non servers config found!');
            }
            serHosts.forEach(function (server) {
                _servers[server.name] = createHA();
                if (server.hosts) {
                    server.hosts.forEach(function (host) {
                        _servers[server.name].add(host);
                    });
                }
                _servers[server.name]._timeout = server.timeout || 30000;
                _servers[server.name]._protocol= server.protocol || 'http';
            });
        }

        function reload(conf) {

            _servers = null;
            _servers = {};
            _options = _.defaults({}, conf.servers);
            init(_options);
        }
    };
    _i.prototype.getServer = function (apiname) {
        var servers = _servers[apiname];

        if (!servers)
            return null;
        else {
            var server = servers.fetch();
            var ret=deepExtend(server);
            ret.timeout = servers._timeout;
            ret.protocol = servers._protocol;
            return ret;
        }
    };
    var instance;
    if (!instance)
        instance = new _i();
    return instance;
})();

module.exports = function (apiname) {
    var s = servers.getServer(apiname);
    var h = s.port ? format('%s://%s:%s', s.protocol, s.host, s.port) : (s.protocol+'://'+s.host);
    s['hostUri'] = h;
    return {
        server: s,
        request: function (path, options, callback) {
            path = String(path).trim();
            if ('/' !== path.substring(0, 1)) {
                path = '/' + path;
            }

            var url = h + path;
            requestor(url, options, callback);
        }
    };
}

//module.exports = {
//    getServer: servers.getServer,
//    request: function (path, options, callback) {
//        path = String(path).trim();
//        if ('/' !== path.substring(0, 1)) {
//            path = '/' + path;
//        }
//        var url = "http://" + servers.getServer(apiname) + path;
//        return request(url, options, callback)
//    }
//};