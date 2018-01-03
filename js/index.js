var chart;
var socket = io();
socket.on('connect', function(){
    console.log('Socket connected.') 
});

socket.on('send', function(data){
    setCoinInfo(data);
});

var app = new Vue({
    el: '#app', 
    data: {
        login: false, // 로그인여부 
        init: false, // 초기화 여부 
        cash: 0, // 현재 보유중인 캐시 
        wait_cash: 0, // 거래 대기중인 캐시 
        buy: true, // 매수, 매도 
        trade_coin: 0, // 거래할 코인 유형
        trade_count: 0, // 거래할 갯수 
        trade_price: 0, // 거래할 단가 
        coins: [ // 코인 정보 
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, rate:'0%', unit:''}
        ]
    },
    mounted: function() { // 로그인상태 조회 
        $.ajax({
            type:'post',
            url:'/process/isLogin',
            dataType: 'json',
            success: function(data){
                app.login = data.result;
                if(data.result){
                    userCoin();
                }
            },
            error: function(){
                app.login = false;
            }
        });
    },
    updated: function(){ // 뷰 업데이트시 로딩영역 없애기 
        if(this.coins[0].name != '-') { // 코인이름이 -가 아닐때 
            $('#loading').hide();
        }
    },
    methods: {
        comma: function (value){
            var len, point, str; 
            value = value + ''; 
            point = value.length % 3 ;
            len = value.length; 

            str = value.substring(0, point); 
            while (point < len) { 
                if (str != '') str += ','; 
                str += value.substring(point, point + 3); 
                point += 3; 
            } 
            return str;
        },
        all: function(){ // 총 자산 
            var sum = this.cash;
            this.coins.forEach(function(coin, index){
                sum += coin.price * coin.own;
            });
            return this.comma(sum);
        },
        refreshUser: function(){
            userCoin();
        },
        setTrade: function(coin, buy){ // 거래 전 초기화 
            this.buy = buy;
            this.trade_coin = coin;
            this.trade_count = this.trade_price = 0;
            this.trade_now_price = this.coins[coin].price;
            if(buy){
                $('#type-text').css('color', 'dodgerblue');
            } else {
                $('#type-text').css('color', 'crimson');
            }
            
            $('#trade-modal').modal();
        },
        trade: function(){ // 거래예상 금액 
            var sum = this.trade_count * this.trade_price;
            return this.comma(sum);
        },
        tradeLog: function(){ // 거래내역 조회 
            $.ajax({
                type:'post',
                url:'/process/tradeLog',
                dataType: 'json',
                success: function(result){
                    setTradeTable(result.data);
                }
            });     
        },
        setPrice: function(){ // 거래시 현재가격으로 설정 
            this.trade_price = this.coins[this.trade_coin].price;
        },
        buyMax: function(){ // 매수가능한 최대갯수 구하기 
            var max = Math.floor((this.cash - this.wait_cash) / this.trade_price);
            if(max === NaN || max === Infinity){
                return 0;
            } else {
                return max;
            }
        },
        isUnable: function(){ // 거래요청 버튼 disable 여부 
            var input_count = this.trade_count;
            if(this.buy){ // 매수 
                if(this.buyMax() < input_count || input_count == ''){
                    return true;
                } else {  
                    return false;
                } 
            } else { // 매도 
                if(this.coins[this.trade_coin].own < input_count || input_count == 0 || input_count == ''){
                    return true;
                } else {  
                    return false;
                } 
            } 
        }
    }
});

// 유저의 자산정보 조회 
function userCoin(){
    $('#user-loading').show();
    $.ajax({
        type:'post',
        url:'/process/userCoin',
        dataType: 'json',
        success: function(info){
            console.log(info);
            if(info){
                app.cash = info.data.cash; // 캐시 
                app.wait_cash = info.data.wait || 0 ; // 거래대기중인 캐시 
                for(let i=1; i<=10; i++){
                    app.coins[i-1].own = info.data['coin' + i];
                }
            }
            $('#user-loading').hide();
        },
        error: function(){
            $('#user-loading').hide();
            alert('서버에 문제가 발생하였습니다');
        }
    });
}

// 코인 시세를 설정 
function setCoinInfo(data){
    data.forEach(function(data, index){
        if(!app.init){ // 초기화를 하지않았을 경우 한번만 코인 이름과 단위 저장 
            app.coins[index].name = data.name;
            app.coins[index].unit = data.unit;
        }
        app.coins[index].price = data.price; 
        
        $('#rate' + index).removeClass('decrease increase');
        var rate = ((data.price - data.standard)/data.standard * 100).toFixed(2);
        if(rate > 0){ // 변동률 0 이상
            app.coins[index].rate = '+' + rate + '%';
            $('#rate' + index).addClass('increase');
        } else if(rate == 0) { // 0
            app.coins[index].rate = '0.00%';
        } else { // 0 미만 
            app.coins[index].rate = rate + '%';
            $('#rate' + index).addClass('decrease');
        }
    });
    
    if(!app.init){
        app.init = true;
    }
}

// 차트데이터 설정 
function setChart(data, coinName){
    var time = [];
    var price = [];
    
    var index = 0;
    for(let i=data.length-1; i>=0; i--, index++){
        time[index] = data[i].time;
        price[index] = data[i].price;
    }
    
    var option = {
        title : {
            text: coinName, // 제목 
            x: 'center' // 가로 중앙 
        },
        tooltip : {
            trigger: 'axis',
        },
        calculable: true,
        xAxis : [
            {
                type : 'category',
                data : time
            }
        ],
        yAxis : [
            {
                type : 'value',
                axisLabel : {
                    formatter: '{value} 캐시'
                }
            }
        ],
        series : [
            {
                name: coinName,
                type:'line',
                data: price,
                itemStyle: {
                    normal: {
                        color: 'dodgerblue'
                    }  
                },
                markPoint : {
                    data : [
                        {type : 'max', name: '최고가'},
                        {type : 'min', name: '최저가'}
                    ]
                },
                markLine : {
                    data : [
                        {type : 'average', name: '평균가'}
                    ]
                }
            }
        ]
    };
    chart = echarts.init($('#chart-area')[0]);
    chart.setOption(option); // 지정한 옵션으로 설정 
}

function setTradeTable(data){
    var str = '<tr>';
    if(data){
        data.forEach(function(log, index){
            str += '<td>' + (index+1) + '</td>';
            str += '<td>' + (log.type == 0 ? '매수':'매도') + '</td>';
            str += '<td>' + app.coins[log.coin].unit + '</td>';
            str += '<td>' + app.comma(log.price) + '</td>';
            str += '<td>' + app.comma(log.count) + '</td>';
            str += '<td>' + app.comma(log.price * log.count) + '</td>';
            str += '<td>' + log.time + '</td>';
            str += '<td><button class="btn btn-danger btn-sm" onclick="tradeCancel(' + log.coin + ',' + log.price + ',' + log.count + ",'" + log.time + "'" + ')">취소하기</button></td></tr>';
        });
    } else {
        str += '<td>데이터가 없습니다</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    }
    $('#trade-data').html(str);
}

function tradeCancel(coin, price, count, time) {
    $.ajax({
        type:'post',
        url:'/process/cancelTrade',
        dataType: 'json',
        data: {coin: coin, price: price, count: count, time: time},
        success: function(data){
            if(data.result){
                alert('거래 취소완료');
            } else {
                alert('거래 취소실패');
            }
            app.tradeLog();
        },
        error: function(){
            alert('서버에 문제가 발생하였습니다');
        }
    });
}

$(function(){
    // 이벤트 처리 //
    $('.navbar-collapse a').click(function(){
        if($(window).width() < 768 ) $('.navbar-collapse').collapse('hide');
    });

    $('select').change(function(){
        var sel = $('select option:selected').val();
        $.ajax({
            type:'post',
            url:'/process/getTimeline',
            dataType: 'json',
            data: {name: sel},
            success: function(data){
                setChart(data.result, sel);
            },
            error: function(){
                alert('서버에 문제가 발생하였습니다');
            }
        });
    });

    $(window).on('resize', function(){
        if(chart != null && chart != undefined){
            chart.resize();
        }
    });
});

