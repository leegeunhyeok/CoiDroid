var chart;
var socket = io();
socket.on('connect', function(){
    console.log('Socket connected.');
});

socket.on('send', function(data){
    setCoinInfo(data); // 서버에서 데이터를 전달받으면 적용 
});

var app = new Vue({
    el: '#app', 
    data: {
        login: false, // 로그인여부 
        id: '',
        init: false, // 초기화 여부 
        cash: 0, // 현재 보유중인 캐시 
        wait_cash: 0, // 거래 대기중인 캐시 
        buy: true, // 매수, 매도 
        trade_coin: 0, // 거래할 코인 유형
        trade_count: 0, // 거래할 갯수 
        trade_price: 0, // 거래할 단가 
        coins: [ // 코인 정보 
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''},
            {name: '-', price: 0, own: 0, wait: 0, rate:'0%', unit:''}
            // 이름, 가격, 보유중인 갯수, 거래대기중인 갯수, 변동률, 단위 
        ]
    },
    mounted: function() { // 로그인상태 조회 
        $.ajax({
            type:'post',
            url:'/process/isLogin',
            dataType: 'json',
            success: function(data){
                app.login = data.result; // 로그인상태를 결과값으로 설정 
                if(data.result){ 
                    app.id = data.id;
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
        comma: function (value){ // 숫자에 콤마 추가하는 함수 
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
                $('#type-text').css('color', 'dodgerblue'); // 매수거래면 글자 파란색 
            } else {
                $('#type-text').css('color', 'crimson'); // 매도거래이면 글자 빨간색 
            }
            
            $('#trade-modal').modal(); // 모달 띄우기 
        },
        trade: function(){ // 거래예상 금액 
            var sum = this.trade_count * this.trade_price;
            return this.comma(sum);
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
                if(this.coins[this.trade_coin].own-this.coins[this.trade_coin].wait < input_count || input_count == 0 || input_count == ''){
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
    var userDone = false;
    $('#user-loading').show();
    $.ajax({
        type:'post',
        url:'/process/userCoin',
        dataType: 'json',
        async: false, // Non async 
        success: function(info){
            if(info){
                userDone = true;
                var user = info.data.user;
                var sell = info.data.sell;
                
                app.cash = user.cash; // 캐시 
                app.wait_cash = user.wait || 0 ; // 거래대기중인 캐시 
                for(let i=1; i<=10; i++){
                    app.coins[i-1].own = user['coin' + i];
                    app.coins[i-1].wait = 0;
                }
                
                sell.forEach(function(data, index){
                    app.coins[data.coin].wait = data.count; // 거래대기중인 코인 갯수 
                });
            }
            $('#user-loading').hide();
        },
        error: function(){
            $('#user-loading').hide();
            alert('서버에 문제가 발생하였습니다');
        }
    });
    
    if(userDone){
        $.ajax({
            type:'post',
            url:'/process/tradeLog',
            dataType: 'json',
            success: function(result){
                setTradeTable(result.data);
            }
        });    
    }
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
    if(data && app.init){
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
            app.refreshUser();
        },
        error: function(){
            alert('서버에 문제가 발생하였습니다');
        }
    });
}

$(function(){
    // 이벤트 처리 //
    // 모바일에서 상단바 메뉴를 클릭하면 자동 닫힘기능 
    $('.navbar-collapse a').click(function(){
        if($(window).width() < 768 ) $('.navbar-collapse').collapse('hide');
    });
    
    // 로그아웃 버튼 
    $('#logout').click(function(){
        $.ajax({
            type:'post',
            url:'/process/logout',
            dataType: 'json',
            success: function(data){
                if(data.result){
                    location.href = '/';
                } else {
                    alert('로그아웃 실패');
                    location.href = '/';
                }
            },
            error: function(){
                alert('서버에 문제가 발생하였습니다');
            }
        });
    });
    
    // 회원가입 폼 submit 이벤트 
    $('#join-form').submit(function(){
        var regExp = /^[a-zA-Z0-9]{6,14}$/;
        var id = $('#id').val();
        var ps1 = $('#password').val();
        var ps2 = $('#password2').val();
        
        // 정규표현식으로 형식 체크 
        if(id.match(regExp) && ps1.match(regExp)){
            if(ps1 == ps2){ // 비밀번호 재입력과 비밀번호가 일치할 경우 
                $.ajax({
                    type:'post',
                    url:'/process/join',
                    async: false, // Non async
                    data: {id: id, password: ps1},
                    success: function(data){
                        console.log(data);
                        console.log(typeof data);
                        var code = data.result;
                        if(code == 0){
                            alert(id + '님 가입을 환영합니다');
                        } else if(code == 1){
                            alert('가입 오류'); 
                        } else if(code == 2) {
                            alert('이미 존재하는 아이디입니다');
                        }
                    },
                    error: function(request, status, error){
                        console.log('code: ' + request.status + '\n' + 'message: ' + request.responseText + '\n' + 'error: ' + error);
                        alert('서버에 문제가 발생하였습니다');
                    }
                });
            } else {
                alert('비밀번호가 일치하지 않습니다');
            }
        } else {
            alert('입력 형식을 확인해주세요(영문, 숫자 6~14 자리)');
        }
    });

    // 차트데이터 선택 
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

    // 창 크기가 변경될경우 EChart 크기 조절 
    $(window).on('resize', function(){
        if(chart != null && chart != undefined){
            chart.resize();
        }
    });
});

