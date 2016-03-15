var ConfigProvider = function(appid, ref) {
    this.ref = ref;
    this.appid = appid;
    this.configuration = {};
};

ConfigProvider.prototype.getConfig = function(callback) {
    var token = this.ref.getAuth().token;
    console.log(token);
    var req = new XMLHttpRequest();
    var url = 'https://auth.wilddog.com/v1/' + this.appid + '/users/webrtc/secret?token=';
    req.open('GET', url + token, false);
    req.send(null);
    if (req.status == 200) {
        var message = JSON.parse(req.responseText);
        console.log(req.responseText);
        this.configuration = {};
        this.configuration.iceServers = message.iceServers;
        console.log("##############");
        console.log(this.configuration);
        callback(this.configuration);
    }
}

exports.ConfigProvider = ConfigProvider;
