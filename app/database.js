'use strict';
var mysql = require('mysql2');
var crypto = require('crypto');

// DB 연결정보 
var connection = mysql.createConnection({
    host:'localhost',
    port:'3306',
    user:'root',
    password:'1234',
    database:'coidroid'
});

// length 길이의 랜덤값 생성 
function genRandomSalt(length){
    return crypto.randomBytes(Math.ceil(length/2)).toString('hex').slice(0, length);
}

// 로그인 유저 인증 
function authUser(id, password, callback){
    var query = 'SELECT * FROM users WHERE _id = "' + id + '" AND AES_DECRYPT(UNHEX(password), SHA2((SELECT salt FROM users WHERE _id = "' + id + '"), 256)) = "' + password + '"';
    connection.query(query, function(err, rows, fields){
         if(err) {
             console.err(err);
             callback(false);
         } else {
             if(rows.length > 0) { // 검색된 데이터가 1이상일경우 
                 callback(rows);
             } else {
                 callback(false);
             }
         }
    });
}

// 아이디 중복확인 
function checkID(id, callback){
    connection.query('SELECT * FROM users WHERE _id = "' + id + '"', function(err, rows, fields){
         if(err) {
             console.err(err);
             callback(false);
         } else {
             if(rows.length > 0) {
                 callback(false);
             } else {
                 callback(true);
             }
         }
    });
}

// 유저 새로 생성 
function createUser(id, ps, callback){
    var salt = genRandomSalt(16); // 암호화키로 사용할 랜덤값 생성 
    var query = 'INSERT INTO users VALUES ("' + id + '", HEX(AES_ENCRYPT("' + ps + '", SHA2("' + salt + '", 256))),"' + salt + '", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000000)';
    
    connection.query(query, function(err, rows, fields){
        if(err) {
            console.log(err);
            callback(false);
        } else {
            if(rows.affectedRows > 0) {
                console.log("Added new user: " + id);
                callback(true);
            } else {
                callback(false);
            }
        }
    });
}

// 유저 정보(코인) 
function userCoin(id, callback){
    var data = {};
    var query1 = 'SELECT coin1, coin2, coin3, coin4, coin5, coin6, coin7, coin8, coin9, coin10, cash, sum(price*count) AS wait FROM users a LEFT JOIN trade b ON a._id=b._id WHERE a._id="' + id + '" AND b.type=0';
    // users 테이블과 trade 테이블을 LEFT JOIN 하여 코인갯수, 캐시, 거래대기중인 캐시를 가져온다
    // 거래대기중인 캐시는 매수거래 가격만 해당하므로 trade.type이 0인 데이터만 가져오도록 함
    
    var query2 = 'SELECT coin, ifnull(sum(count), 0) AS count FROM trade WHERE _id="' + id + '" AND type=1 GROUP BY coin';
    // 코인 종류로 그룹나누고 해당 유저의 매도(type=1)거래 대기중인 코인의 갯수를 가져온다 
    
    connection.query(query1, function(err, rows, fields){
        if(err){
            callback(null);
        } else {
            data.user = rows[0];
            connection.query(query2, function(err, rows, fields){
                if(err){
                    callback(null);
                } else {
                    data.sell = rows;
                    callback(data);
                }
            });
        }
    });
}

// 차트데이터로 사용할 데이터 조회 
function getTimeline(coinName, callback){
    var query = 'SELECT * FROM coin_timeline WHERE type="' + coinName + '" ORDER BY time DESC LIMIT 0, 288';
    console.log(query);
    connection.query(query, function(err, rows, fields){
        if(err) {
            callback(null);
        } else {
            callback(rows);   
        }
    });
}

// 거래내역 추가 
function addTrade(id, coin, type, price, count, callback){
    var query = 'INSERT INTO trade SELECT "' + id + '", ' + coin + ', ' + type + ', ' + price + ', ' + count + ', ' + 'now() FROM DUAL WHERE EXISTS';
    if(type == 0){
        query += '(SELECT * FROM users WHERE (SELECT cash FROM users WHERE _id="' + id +'")-' + (price * count) +'-(SELECT ifnull(sum(price*count), 0) FROM trade WHERE type=0 AND _id="' + id +'")>=0)'; // 보유중인 캐시-거래금액이 0이상일 경우
    } else {
        query += '(SELECT * FROM users WHERE coin' + (parseInt(coin, 10)+1) + '-' + count + '-(SELECT ifnull(sum(count), 0) FROM trade WHERE _id="' + id + '" AND type=1 AND coin=' + coin +')>=0)'; // 보유중인 코인-매도수량이 0이상일 경우 
    }
    
    console.log(query);
    connection.query(query, function(err, rows, fields){
        if(err){
            console.log(err);
            callback(false);
        } else {
            if(rows.affectedRows > 0){ // 반영된 데이터수가 0 이상이면 true 
                callback(true);
            } else {
                callback(false);
            }
        }
    });
}

// 거래내역 조회 
function getTrade(id, callback){
    var query = 'SELECT * FROM trade WHERE _id="' + id + '" ORDER BY time DESC LIMIT 0, 10'; // 최근 10개의 데이터 
    connection.query(query, function(err, rows, fields){
        if(err){
            console.log(err);
            callback(false);
        } else {
            if(rows.length > 0){ 
                callback(rows);
            } else {
                callback(false);
            }
        }
    });
}

// 진행중인 거래 삭제 
function cancelTrade(id, coin, price, count, time, callback){
    var query = 'DELETE FROM trade WHERE _id="' + id + '" AND coin=' + coin + ' AND price=' + price + ' AND count=' + count + ' AND time="' + new Date(time).format('yyyy-MM-dd HH:mm:ss') + '"';
    console.log(query);
    connection.query(query, function(err, rows){
        if(err){
            console.log(err);
            callback(false);
        } else {
            if(rows.affectedRows == 1){
                callback(true);
            } else {
                callback(false);
            }
        }
    });
}

exports.get = function(){
    return connection;
}

exports.init = function(){
    return {
        authUser: authUser,
        checkID: checkID,
        createUser: createUser,
        userCoin: userCoin,
        getTimeline: getTimeline,
        addTrade: addTrade,
        getTrade: getTrade,
        cancelTrade: cancelTrade
    };
};
