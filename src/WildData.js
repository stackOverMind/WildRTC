var WildData = function(ref) {
    this.ref = ref;
}

WildData.prototype.onUserAdd = function(callback) {
    ref.child('users').on('child_added', function(snap){
    	callback(snap.key());
    });
};

WildData.prototype.onUserRemoved = function(callback) {
    ref.child('users').on('child_removed', function(snap){
    	callback(snap.key());
    });
};

// WildData.prototype.onUserState = function(callback) {
//     ref.child('userStates').on('child_changed', function(snap){
//     	callback(snap.key());
//     });
// };

WildData.prototype.join = function(uId, callback) {
    ref.child('users/' + uId).update({ 'state': 'created' }, function(err) {
        if (err == null) {
            ref.child('userStates').update({ uId: false }, function(err) {
                callback(err);
            })
        } else {
            callback(err);
        }
    })
};

WildData.prototype.leave = function(uId) {
    ref.child('users').off('child_added');
    ref.child('users').off('child_removed');
    ref.child('userStates').off('child_changed');
    ref.child('users/' + uId).remove();
    ref.child('userStates/' + uId).remove();
}

module.exports = WildData;