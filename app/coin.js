'use strict';

var connection;
var coins = [];
var standard = [];
var addition = [];

Date.prototype.format = function(f) {
    if (!this.valueOf()) return " ";
    var d = this;
     
    return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function($1) {
        switch ($1) {
            case "yyyy": return d.getFullYear();
            case "MM": return (d.getMonth() + 1);
            case "dd": return d.getDate();
            case "HH": return d.getHours();
            case "mm": return d.getMinutes();
            case "ss": return d.getSeconds();
            default: return $1;
        }
    });
};

// 추가 변동폭(%) 새로 지정 
exports.changeAddtion = function(){
    addition.forEach(function(data, i){
        data = Math.floor((Math.random() * 4)); // 0 ~ 3
    });
    console.log('\x1b[36m', 'Addtion Number changed');
}

// 변동률 기준가격 변경 
exports.refreshChangeRate = function(){
    coins.forEach(function(coin, i){
        standard[i] = coin.price; //현재의 가격으로 
    });
    console.log('\x1b[36m', 'Standard price changed');
}

// 코인 데이터 저장 
exports.saveData = function(){
    var date = new Date().format('yyyy-MM-dd HH:mm:ss');
    coins.forEach(function(coin){
        connection.query('INSERT INTO coin_timeline VALUES ("' + coin.name + '", ' + coin.price + ', "' + date + '");');
    });  
    console.log('\x1b[36m', 'Data saved - ' + date);
}

// 거래진행 
exports.tradeCheck = function(){
    connection.query('SELECT * FROM trade;', function(err, rows, fields){
        if(err){
            console.log('Get trade log error');
        } else {
            // 모든 거래내역을 불러온 후 1개씩 거래진행 
            rows.forEach(function(data, index){
                var coinPrice = coins[data.coin].price;
                var tempPrice = data.price;
                var tempCount = data.count;
                var tempTotal = tempPrice * tempCount;
                var tempCoin = 'coin' + (data.coin + 1);
                
                if(data.type == 0) { // 0: 매수거래 
                    if(coinPrice <= tempPrice){ // 거래요청한 단가가 현재 코인단가 이상인 경우 체결 
                        // 코인갯수 * 금액만큼의 가격을 캐시에서 차감한 후 구매한 코인갯수를 갯수만큼 증가 
                        var query = 'UPDATE users SET cash=cash'+'-'+tempTotal+','+tempCoin+'='+tempCoin+'+'+tempCount+' WHERE _id="'+data._id+'"';
                        console.log(query);
                        connection.query(query, function(err, rows, fields){
                            if(err){
                                console.log("Trade Error - Buy");
                            }
                            connection.query('DELETE FROM trade WHERE price='+tempPrice+' AND count='+tempCount+' AND _id="'+data._id+'"');  
                        });
                    }
                } else { // 1: 매도거래 
                    if(coinPrice >= tempPrice){
                        var query = 'UPDATE users SET cash=cash'+'+'+tempTotal+','+tempCoin+'='+tempCoin+'-'+tempCount+' WHERE _id="'+data._id+'"';
                        console.log(query);
                                
                        connection.query(query, function(err, rows, fields){
                            if(err){
                                console.log("Trade Error - Sell");
                            }
                            connection.query('DELETE FROM trade WHERE price='+tempPrice+' AND count='+tempCount+' AND _id="'+data._id+'";');  
                        });
                     }
                }
            });
        }
    });
}

// 가격변동 및 데이터 전송 
exports.getData = function(){
    coins.forEach(function(coin, index){
        var per = Math.floor((Math.random() * 5) - 2) + addition[index]; // 2 ~ -2 (+Addtion)
        var tempPrice = Math.floor(coin.price * (per/100));
        
        if(coin.price + tempPrice >= 50){ // 가격이 50 미만으로 내려가는것을 방지 
            coin.price += tempPrice; 
            coin.rate = (((coin.price-standard[index])/standard[index]) * 100).toFixed(2); //변동률 
        } else {
            addition[index] += 1; 
        }
    });
    return coins;
}

// 초기화 
exports.init = function(app){
    connection = app.get('database');
    connection.query('SELECT * FROM coins', function(err, rows, fields){
        if(err) throw err;
        rows.forEach(function(data, index){
            standard[index] = data.price;
            coins[index] = {name: data.type, price: data.price, rate: 0, unit: data.unit};
            addition[index] = 0;
        });  
    });
}