/**
 * Created by Heshan.i on 12/5/2016.
 */

var redis = require('redis');
var util = require('util');
var config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var eventEmitter = require('events').EventEmitter;

//--------------------Dashboards Redis Client-------------------------------------
var client = redis.createClient(config.Redis.port, config.Redis.ip);
client.auth(config.Redis.password);
client.select(config.Redis.redisDB, redis.print);
//client.select(config.Redis.redisdb, function () { /* ... */ });
client.on("error", function (err) {
    logger.error('Redis connection error :: %s', err);
});

client.on("connect", function (err) {
    client.select(config.Redis.redisDB, redis.print);
});


//--------------------Ards Redis Client-------------------------------------

var ardsClient = redis.createClient(config.ArdsRedis.port, config.ArdsRedis.ip);
ardsClient.auth(config.ArdsRedis.password);
ardsClient.select(config.ArdsRedis.ardsRedisDB, redis.print);
//client.select(config.Redis.redisdb, function () { /* ... */ });
ardsClient.on("error", function (err) {
    logger.error('ARDS Redis connection error :: %s', err);
});

ardsClient.on("connect", function (err) {
    ardsClient.select(config.ArdsRedis.ardsRedisDB, redis.print);
});



var GetHashValue = function (keys, field) {
    var e = new eventEmitter();
    var count = 0;
    for (var i=0; i< keys.length; i++) {
        var key = keys[i];
        client.hget(key, field, function (err, hValue) {

            count++;

            if(err){
                logger.error('Redis hget error :: %s', err);
            }else{
                e.emit('result', hValue);
            }

            if (keys.length === count) {
                console.log("end", count);
                e.emit('end');
            }
        });
    }
    return (e);
};

var searchObjects = function(searchPattern, callback){
    var result = [];

    getKeyCounts(function(err, keyCount){
        if(err){
            callback(err, result);
        }else{
            client.scan(0, 'MATCH', searchPattern, 'count', keyCount, function (err, replies) {
                if (err) {
                    logger.error('Redis searchKeys error :: %s', err);
                    callback(err, result);
                } else {
                    logger.info('Redis searchKeys success :: replies:%s', replies.length);
                    if (replies && replies.length > 0 && replies[1] && replies[1].length > 0) {
                        client.mget(replies[1], function(err, objs){
                            if(err){
                                logger.error('Redis searchKeys (mget) error :: %s', err);
                                callback(err, result);
                            }else{
                                logger.info('Redis searchKeys (mget) success :: %s', objs);
                                callback(err, objs);
                            }
                        });
                    } else {
                        callback(null, result);
                    }
                }
            });
        }
    });
};

var searchHashes = function(searchPattern, hashField, callback){
    var result = [];

    getKeyCounts(function(err, keyCount){
        if(err){
            callback(err, result);
        }else{
            client.scan(0, 'MATCH', searchPattern, 'count', keyCount, function (err, replies) {
                if (err) {
                    logger.error('Redis searchKeys error :: %s', err);
                    callback(err, result);
                } else {
                    logger.info('Redis searchKeys success :: replies:%s', replies.length);
                    if (replies && replies.length > 0 && replies[1] && replies[1].length > 0) {
                        var ghv = GetHashValue(replies[1], hashField);

                        ghv.on('result', function (hValue) {
                            result.push(hValue);
                        });

                        ghv.on('end', function () {
                            callback(null, result);
                        });
                    } else {
                        callback(null, result);
                    }
                }
            });
        }
    });
};

var searchKeys = function(searchPattern, callback) {
    var result = [];

    getKeyCounts(function (err, keyCount) {
        if (err) {
            callback(err, result);
        } else {
            client.scan(0, 'MATCH', searchPattern, 'count', keyCount, function (err, replies) {
                if (err) {
                    logger.error('Redis searchKeys error :: %s', err);
                    callback(err, result);
                } else {
                    logger.info('Redis searchKeys success :: replies:%s', replies.length);
                    if (replies && replies.length > 0 && replies[1] && replies[1].length > 0) {
                        callback(null, replies[1]);
                    } else {
                        callback(null, result);
                    }
                }
            });
        }
    });
};

var getHashField = function(key, field, callback){
    ardsClient.hget(key, field, function (err, hValue) {
        if(err){
            logger.error('Redis getHashField error :: %s', err);
            callback(err, undefined);
        }else{
            logger.info('Redis getHashField Success');
            callback(undefined, hValue);
        }
    });
};

var getKeyCounts = function(callback){
    client.dbsize(function (err, replies) {
        if (err) {
            logger.error('Redis getKeyCounts error :: %s', err);
            callback(err, 0);
        } else {
            logger.info('Redis getKeyCounts success :: replies:%d', replies);
            callback(null, replies+1000);
        }
    });
};

module.exports.SearchObjects = searchObjects;
module.exports.SearchHashes = searchHashes;
module.exports.SearchKeys = searchKeys;
module.exports.GetHashField = getHashField;