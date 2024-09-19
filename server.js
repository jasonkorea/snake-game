// server.js
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

let players = {};
let apples = [];
let appleCount = 5; // 맵에 존재하는 사과의 수

// 랜덤 위치 생성 함수
function getRandomPosition() {
    return {
        x: Math.floor(Math.random() * 40) * 20,
        y: Math.floor(Math.random() * 30) * 20
    };
}

// 임의의 색상 생성 함수
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 초기 사과 생성
for (let i = 0; i < appleCount; i++) {
    apples.push(getRandomPosition());
}

io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);

    // 새로운 플레이어 추가
    socket.on('newPlayer', (data) => {
        players[socket.id] = {
            x: 400,
            y: 300,
            direction: 'up', // 'up', 'down', 'left', 'right'
            name: data.name,
            size: 3, // 초기 길이 3으로 설정
            tail: [],
            score: 0,
            initialSize: 3,
            color: getRandomColor(),
            moveCounter: 0 // 이동 주기를 제어하기 위한 카운터
        };
    });

    socket.on('changeDirection', (data) => {
        let player = players[socket.id];
        if (player) {
            const newDirection = data.direction;
            const oppositeDirections = {
                'up': 'down',
                'down': 'up',
                'left': 'right',
                'right': 'left'
            };
            if (newDirection !== oppositeDirections[player.direction]) {
                player.direction = newDirection;
                player.moveCounter = 0;  // 방향 전환 시 이동 카운터 초기화
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        console.log('사용자 연결 해제됨:', socket.id);
    });
});

// 게임 상태 업데이트 로직
const BASE_UPDATE_INTERVAL = 100; // 기본 상태 업데이트 주기 (ms)

setInterval(() => {
    let sockets = Object.keys(players);

    // 모든 지렁이를 이동시키고 충돌 체크를 수행합니다.
    for (let id of sockets) {
        let player = players[id];

        let moveInterval = Math.max(1, Math.floor(player.size / player.initialSize));

        player.moveCounter++;

        if (player.moveCounter >= moveInterval) {
            player.moveCounter = 0;

            player.tail.unshift({ x: player.x, y: player.y });
            if (player.tail.length > player.size) {
                player.tail.pop();
            }

            switch (player.direction) {
                case 'up':
                    player.y -= 20;
                    break;
                case 'down':
                    player.y += 20;
                    break;
                case 'left':
                    player.x -= 20;
                    break;
                case 'right':
                    player.x += 20;
                    break;
            }

            if (player.x < 0) {
                player.x = 780;
            } else if (player.x >= 800) {
                player.x = 0;
            }

            if (player.y < 0) {
                player.y = 580;
            } else if (player.y >= 600) {
                player.y = 0;
            }

            // 충돌 체크 및 메모리 관리 최적화
            for (let i = 1; i < player.tail.length; i++) {
                let segment = player.tail[i];
                if (segment.x === player.x && segment.y === player.y) {
                    player.size = player.initialSize;
                    player.tail = [];
                    let newPos = getRandomPosition();
                    player.x = newPos.x;
                    player.y = newPos.y;
                    break;
                }
            }

            // 사과와의 충돌 체크
            for (let i = 0; i < apples.length; i++) {
                let apple = apples[i];
                if (player.x === apple.x && player.y === apple.y) {
                    player.size += 1; // 지렁이 길이 증가
                    apples.splice(i, 1);
                    apples.push(getRandomPosition());
                    break;
                }
            }

            // 지렁이 간 충돌 체크
            let playerIds = Object.keys(players);
            for (let i = 0; i < playerIds.length; i++) {
                let player1 = players[playerIds[i]];
                for (let j = 0; j < playerIds.length; j++) {
                    let player2 = players[playerIds[j]];

                    if (player1 !== player2) {
                        for (let segment of player2.tail) {
                            if (player1.x === segment.x && player1.y === segment.y) {
                                if (player1.size > player2.size) {
                                    player2.size = player2.initialSize;
                                    player2.tail = [];
                                    let newPos = getRandomPosition();
                                    player2.x = newPos.x;
                                    player2.y = newPos.y;
                                    player1.score += 10;
                                } else {
                                    player1.size = player1.initialSize;
                                    player1.tail = [];
                                    let newPos = getRandomPosition();
                                    player1.x = newPos.x;
                                    player1.y = newPos.y;
                                    player2.score += 10;
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    let ranking = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .map((player, index) => {
            return {
                rank: index + 1,
                name: player.name,
                score: player.score
            };
        });

    io.sockets.emit('state', { players: players, apples: apples, ranking: ranking });
}, BASE_UPDATE_INTERVAL);

http.listen(port, () => {
    console.log(`서버가 ${port} 포트에서 실행 중입니다.`);
});
