'use strict';
var fs = require('fs');
var database = require('./database'),
    db = database.init();

// HTML 파일 읽어서 응답 
function readHtml(path, res){
    fs.readFile(path, function(err, data){
        if(err) throw err;
        
        res.writeHead(200, {'Content-Type':'text/html'});
        res.write(data);
        res.end();
    });
}

// 메인페이지 
function main(req, res){
    readHtml('./public/index.html', res);
}

// 회원가입 
function join(req, res){
    var id = req.body.id;
    var password = req.body.password;
    
    db.checkID(id, function(data){ // ID 중복체크 
        if(data){
            db.createUser(id, password, function(result){ // 중복되지 않았을경우 유저 추가 
                res.send({result: result, already: false});
            });
        } else {
            res.send({result: null, already: true});
        }
    });
}

// 로그인 
function login(req, res){
    var id = req.body.id;
    var password = req.body.password;
    
    db.authUser(id, password, function(result){
        // 성공시 세션 등록 
        if(result){
            req.session.user = id;
            res.redirect('/');
        } else {
            res.send('<script>alert("일치하는 사용자가 없습니다"); location.href="/"; </script>');
        }
    });
}

// 로그인 상태 확인 
function isLogin(req, res){
    var id = req.session.user;
    
    if(id !== undefined){
        res.send({result: true, id: id});
    } else {
        res.send({result: false});
    }
}

// 로그아웃 
function logout(req, res){
    var user = req.session.user;
    if(user){
        req.session.destroy(function(err){
            if(err){
                res.send({result: false});
            } 
            res.send({result: true});
        });
    } else {
        res.send({result: false});
    }
}

// 사용자의 코인 정보 조회
function userCoin(req, res){
    var id = req.session.user;
    
    if(id === undefined){
        res.send(null);
    } else {
        db.userCoin(id, function(coins){
            if(coins){
                res.send({data: coins});
            } else {
                res.send({data: null});
            }
        });
    }
}

// 차트데이터 조회 
function getTimeline(req, res){
    var coinName = req.body.name;
    db.getTimeline(coinName, function(data){
        if(data){
            res.send({result: data});
        } else {
            res.send({result: false});
        }
    });
}

// 거래 등록 
function trade(req, res){
    var coin = req.body.coin;
    var price = req.body.price;
    var count = req.body.count;
    var type = req.body.type != undefined ? 0 : 1; // buy, sell
    var id = req.session.user;
    
    if(id === undefined) {
        res.send('<script>alert("세션이 존재하지 않습니다"); location.href = "/"</script>');
    } else {
        db.addTrade(id, coin, type, price, count, function(result){
            if(result){
                res.send('<script>alert("거래요청 완료"); location.href = "/"</script>');
            } else {
                res.send('<script>alert("거래요청 실패"); location.href = "/"</script>');
            }
        }); 
    }
}

// 진행중인 거래내역 조회 
function tradeLog(req, res){
    var id = req.session.user;
    
    if(id === undefined) {
        res.send({data: false});
    } else {
        db.getTrade(id, function(result){
            if(result){
                res.send({data: result});
            } else {
                res.send({data: false});
            }
        }); 
    }
}

// 거래 취소 
function cancelTrade(req, res){
    var id = req.session.user;
    var coin = req.body.coin;
    var price = req.body.price;
    var count = req.body.count;
    var time = req.body.time;
    
    if(id === undefined){
        res.send({result: false});
    } else {
        db.cancelTrade(id, coin, price, count, time, function(result){
            res.send({result: result});
        });
    }
}

// route.db() 
exports.db = function(){
    return database.get(); // connection 객체
};

// require('router').route() 
exports.route = function(){
    return {
        main: main,
        process: {
            join: join,
            login: login,
            isLogin: isLogin,
            logout: logout,
            userCoin: userCoin,
            getTimeline: getTimeline,
            trade: trade,
            tradeLog: tradeLog,
            cancelTrade: cancelTrade
        }
    };
};