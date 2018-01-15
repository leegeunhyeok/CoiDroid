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
    errorHandler = require('express-error-handler'),
    route = require('./app/router'),
    routePath = route.route();

var path = require('path'),
	serv_static = require('serve-static');

var cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
	session = require('express-session');

var socket = require('./app/socket');

var app = express();

/* App set */
app.set('port', 80);

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

/*--- Router Setting ---*/
var router = express.Router();
router.route('/').get(routePath.main); // 메인화면
router.route('/process/join').post(routePath.process.join); // 회원가입 진행 
router.route('/process/login').post(routePath.process.login); // 로그인 
router.route('/process/isLogin').post(routePath.process.isLogin); // 로그인 확인 
router.route('/process/logout').post(routePath.process.logout); // 로그아웃 
router.route('/process/userCoin').post(routePath.process.userCoin); // 사용자 코인정보 불러오기 
router.route('/process/getTimeline').post(routePath.process.getTimeline); // 차트데이터 불러오기 
router.route('/process/trade').post(routePath.process.trade); // 거래등록 
router.route('/process/tradeLog').post(routePath.process.tradeLog); // 거래내역 조회
router.route('/process/cancelTrade').post(routePath.process.cancelTrade); // 거래 취소 
app.use(router);

/* Error handler */
var handler = errorHandler({
    static: {
        '404':'./public/index.html' // 존재하지 않는 페이지로 이동할경우 index.html 응답 
    } 
});

app.use(errorHandler.httpError(404));
app.use(handler);

/* Create server */
http.createServer(app).listen(app.get('port'), function(){
    console.log('Coidroid server start');
    socket.init(this, route.db());
});
