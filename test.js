/**
 * Created by zhigang on 14/10/27.
 */
var client = require('./api_client.js');
var cli = client('roshanApi');
console.log(cli.server);
cli.request('/list', {}, function (err, res) {
    if (err) {
        console.log(err);
    }
    else
        console.log(res);

});
console.log(server);
cli = client('roshanApi');
console.log(cli.server.hostUri);
cli = client('roshanApi');
console.log(cli.server);
var server = client('orderApi');
console.log(server.server);