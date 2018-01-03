/*--------------------------*
 * --- NodeJS WebServer --- *
 * ------------------------	*
 * -- Dev: Leegeunhyeok --- *
 * - Start day : 2017-12-28 *
 * -------------------------*
 * ------- CoiDroid ------- *
 *--------------------------*/
'use strict';
var express = require('express'),
	http = require('http'),
    errorHandler = require('express-error-handler');

var path = require('path'),
    fs = require('fs'),
	serv_static = require('serve-static');

var cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
	session = require('express-session');

var socket = require('./app/socket');

var mysql = require('mysql2');

// DB 연결정보 
var connection = mysql.createConnection({
    host:'localhost',
    port:'3306',
    user:'root',
    password:'1234',
    database:'coidroid'
});

// 로그인 유저 인증 
function authUser(id, password, callback){
    var query = 'SELECT * FROM users WHERE _id = "' + id + '" AND password = "' + password + '";';
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
    connection.query('SELECT * FROM users WHERE _id = "' + id + '";', function(err, rows, fields){
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
    var query = 'INSERT INTO users VALUES ("' + id + '", "' + ps + '", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000000)';

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
    var query = 'SELECT coin1, coin2, coin3, coin4, coin5, coin6, coin7, coin8, coin9, coin10, cash, sum(price*count) AS wait FROM users a LEFT JOIN trade b ON a._id=b._id WHERE a._id="' + id + '" AND b.type=0';
    // users 테이블과 trade 테이블을 LEFT JOIN 하여 코인갯수, 캐시, 거래대기중인 캐시를 가져온다
    // 거래대기중인 캐시는 매수거래 가격만 해당하므로 trade.type이 0인 데이터만 가져오도록 함
    connection.query(query, function(err, rows, fields){
        if(err){
            callback(null);
        } else {
            callback(rows[0]);
        }
    });
}

// 차트데이터로 사용할 데이터 조회 
function getTimeline(coinName, callback){
    var query = 'SELECT * FROM coin_timeline WHERE type="' + coinName + '" ORDER BY time DESC LIMIT 0, 288;';
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
function addTrade(id, coin, price, count, type, callback){
    var query = 'INSERT INTO trade VALUES ("' + id + '", ' + coin + ', ' + type + ', ' + price + ', ' + count + ', ' + 'now());';
    console.log(query);
    connection.query(query, function(err, rows, fields){
        if(err){
            console.log(err);
            callback(false);
        } else {
            if(rows.affectedRows > 0){
                callback(true);
            } else {
                callback(false);
            }
        }
    });
}

// 거래내역 조회 
function getTrade(id, callback){
    var query = 'SELECT * FROM trade WHERE _id="' + id + '" ORDER BY time DESC LIMIT 0, 10';
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

var app = express();

/* App set */
app.set('port', 8080);
app.set('database', connection);

/* Use middleware */
app.use('/js', serv_static(path.join(__dirname, 'js')));
app.use('/css', serv_static(path.join(__dirname, 'css')));
app.use('/fonts', serv_static(path.join(__dirname, 'fonts')));
app.use('/image', serv_static(path.join(__dirname, 'image')));
app.use('/public', serv_static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({
	secret:'c0iDroId@N0de.js',
	resave: false,
	saveUninitialized: true
}));

function readHtml(path, res){
    fs.readFile(path, function(err, data){
        if(err) throw err;
        
        res.writeHead(200, {'Content-Type':'text/html'});
        res.write(data);
        res.end();
    });
}

/*--- Router Setting ---*/
var router = express.Router();
router.route('/').get(function(req, res){
    readHtml('./public/index.html', res);
});

router.route('/user').get(function(req, res){
    if(req.session.user) {
        readHtml('./public/user.html', res);
    } else {
        res.send('<script>alert("로그인 후 이용가능합니다"); location.href="/"; </script>');
    }
});

// 회원가입 진행 
router.route('/process/join').post(function(req, res){
    var regExp = /^[a-zA-Z0-9]{6,14}$/;
    var id = req.body.id;
    var ps1 = req.body.password;
    var ps2 = req.body.password2;
    
    if(ps1 == ps2){
        if(ps1.match(regExp) && id.match(regExp)){
            checkID(id, function(data){
                if(data){
                    createUser(id, ps1, function(result){
                        if(result){
                            res.send('<script>alert("가입을 환영합니다");location.href="/"</script>');
                        } else {
                            res.send('<script>alert("가입오류");location.href="/"</script>');
                        }
                    });
                } else {
                    res.send('<script>alert("이미 존재하는 아이디입니다");location.href="/"</script>');
                }
            });
        } else {
            res.send('<script>alert("형식에 맞춰서 제출해주세요");location.href="/"</script>');
        }
    } else {
        res.send('<script>alert("비밀번호가 일치하지 않습니다");location.href="/"</script>');
    }
});

// 로그인 
router.route('/process/login').post(function(req, res){
    var id = req.body.id;
    var password = req.body.password;
    
    authUser(id, password, function(result){
        // 성공시 세션 등록 
        if(result){
            req.session.user = id;
            res.redirect('/');
        } else {
            res.send('<script>alert("일치하는 사용자가 없습니다"); location.href="/"; </script>');
        }
    });
});

// 로그인 확인 
router.route('/process/isLogin').post(function(req, res){
    var id = req.session.user;
    
    if(id !== undefined){
        res.send({result: true, id: id});
    } else {
        res.send({result: false});
    }
});

// 로그아웃 
router.route('/process/logout').get(function(req, res){
    var user = req.session.user;
    if(user){
        req.session.destroy(function(err){
            if(err){
                console.log('Logout failed');
            } 
        });
    }
    res.redirect('/');
});

// 사용자 코인정보 불러오기 
router.route('/process/userCoin').post(function(req, res){
    var id = req.session.user;
    
    if(id === undefined){
        res.send('<script>alert("세션이 존재하지않습니다."); location.href="/"; </script>');
    } else {
        userCoin(id, function(coins){
            if(coins){
                res.send({data: coins});
            } else {
                res.send({data: null});
            }
        });
    }
});

// 차트데이터 불러오기 
router.route('/process/getTimeline').post(function(req, res){
    var coinName = req.body.name;
    getTimeline(coinName, function(data){
        if(data){
            res.send({result: data});
        } else {
            res.send({result: false});
        }
    });
});

// 거래등록 
router.route('/process/trade').post(function(req, res){
    var coin = req.body.coin;
    var price = req.body.price;
    var count = req.body.count;
    var type = req.body.type != undefined ? 0 : 1; // buy, sell
    var id = req.session.user;
    
    if(id == undefined) {
        res.send('<script>alert("세션이 존재하지 않습니다"); location.href = "/"</script>');
    } else {
        addTrade(id, coin, price, count, type, function(result){
            if(result){
                res.send('<script>alert("거래요청 완료"); location.href = "/"</script>');
            } else {
                res.send('<script>alert("거래요청 실패"); location.href = "/"</script>');
            }
        }); 
    }
});

// 거래내역 조회
router.route('/process/tradeLog').post(function(req, res){
    var id = req.session.user;
    
    if(id === undefined) {
        res.send({data: false});
    } else {
        getTrade(id, function(result){
            if(result){
                res.send({data: result});
            } else {
                res.send({data: false});
            }
        }); 
    }
});

// 거래 취소 
router.route('/process/cancelTrade').post(function(req, res){
    var id = req.session.user;
    var coin = req.body.coin;
    var price = req.body.price;
    var count = req.body.count;
    var time = req.body.time;
    
    if(id === undefined){
        res.send({result: false});
    } else {
        cancelTrade(id, coin, price, count, time, function(result){
            res.send({result: result});
        });
    }
});

app.use(router);

/* Error handler */
var handler = errorHandler({
    static: {
        '404':'./public/index.html'
    } 
});

app.use(errorHandler.httpError(404));
app.use(handler);

/* Create server */
http.createServer(app).listen(app.get('port'), function(){
    console.log('Coidroid server start');
    socket.init(this, app);
});
