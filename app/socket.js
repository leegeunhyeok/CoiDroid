'use strict';

var coin = require('./coin');
const sec = 1000; // 1000 ms = 1 sec

exports.init = function(server ,app){
    coin.init(app);
    var io = require('socket.io').listen(server);
    setInterval(function(){
        coin.tradeCheck(); // 3초마다 거래진행 및 가격변동  
        io.sockets.emit('send', coin.getData()); // 데이터 전송 
    }, sec * 3); // 3초 
     
    var standardRateTick = 0;
    var saveTick = 0;
    
    coin.deleteOlddata();
    setInterval(function(){
        standardRateTick++;
        saveTick++;
        coin.changeAddtion();
        
        if(saveTick >= 5){
            saveTick = 0;
            coin.saveData(); // 5분에 한번 저장
        }
        
        if(standardRateTick >= 60){
            standardRateTick = 0;
            coin.refreshChangeRate(); // 기준값 변경(60분)
            coin.deleteOlddata(); // 현재시간에서 1주일 이전 데이터는 삭제 
        }
    }, sec * 60); // 1분
}