// catur.js

const chessboard = document.getElementById('chessboard');
const whiteTurnIndicator = document.getElementById('white-turn-indicator');
const blackTurnIndicator = document.getElementById('black-turn-indicator');
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionOptionsDiv = document.getElementById('promotion-options');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessage = document.getElementById('game-over-message');
const gameOverDetails = document.getElementById('game-over-details');

let board = []; // 2D array representing the chessboard state
let currentPlayer = 'white'; // 'white' or 'black'
let selectedSquare = null; // Stores the DOM element of the currently selected square
let enPassantTargetSquare = null; // Stores [row, col] of the square behind a pawn that moved two squares
let canWhiteCastleKingSide = true;
let canWhiteCastleQueenSide = true;
let canBlackCastleKingSide = true;
let canBlackCastleQueenSide = true;

// Stores coordinates for pawn promotion: [startRow, startCol, endRow, endCol]
let pendingPromotionMove = null;

// Unicode Chess Pieces (White are lowercase, Black are uppercase)
const pieces = {
    'R': '&#9814;', 'N': '&#9816;', 'B': '&#9815;', 'Q': '&#9813;', 'K': '&#9812;', 'P': '&#9817;', // Black
    'r': '&#9820;', 'n': '&#9822;', 'b': '&#9821;', 'q': '&#9819;', 'k': '&#9818;', 'p': '&#9823;'  // White
};

// --- Game State Management ---

function initializeBoard() {
    board = [
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    ];
    currentPlayer = 'white'; // Player (user) is always white
    selectedSquare = null;
    enPassantTargetSquare = null;
    canWhiteCastleKingSide = true;
    canWhiteCastleQueenSide = true;
    canBlackCastleKingSide = true;
    canBlackCastleQueenSide = true;
    pendingPromotionMove = null;

    promotionOverlay.style.display = 'none';
    gameOverOverlay.style.display = 'none';

    updateTurnIndicator();
    renderBoard();
}

function renderBoard() {
    chessboard.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = r;
            square.dataset.col = c;

            const pieceChar = board[r][c];
            if (pieceChar) {
                const pieceElement = document.createElement('span');
                pieceElement.classList.add('piece');
                pieceElement.innerHTML = pieces[pieceChar];
                square.appendChild(pieceElement);
            }
            square.addEventListener('click', handleSquareClick);
            chessboard.appendChild(square);
        }
    }
}

function updateTurnIndicator() {
    if (currentPlayer === 'white') {
        whiteTurnIndicator.textContent = 'Giliran: Putih';
        blackTurnIndicator.textContent = 'Giliran: Hitam (Menunggu)';
    } else {
        whiteTurnIndicator.textContent = 'Giliran: Putih (Menunggu)';
        blackTurnIndicator.textContent = 'Giliran: Hitam';
    }
}

// --- Player Interaction ---

function handleSquareClick(event) {
    if (currentPlayer === 'black' || promotionOverlay.style.display === 'flex' || gameOverOverlay.style.display === 'flex') {
        console.log("Not player's turn or game state preventing action.");
        return;
    }

    const clickedSquare = event.currentTarget;
    const row = parseInt(clickedSquare.dataset.row);
    const col = parseInt(clickedSquare.dataset.col);

    const pieceOnClickedSquare = board[row][col];
    const isPlayersPiece = pieceOnClickedSquare && pieceOnClickedSquare === pieceOnClickedSquare.toLowerCase();

    if (selectedSquare) {
        const startRow = parseInt(selectedSquare.dataset.row);
        const startCol = parseInt(selectedSquare.dataset.col);

        if (startRow === row && startCol === col) {
            clearSelectionAndMoves();
        } else if (isValidMove(startRow, startCol, row, col, board, currentPlayer)) {
            pendingPromotionMove = [startRow, startCol, row, col]; // Store for potential promotion
            
            // Execute the move visually and update board data in callback
            movePiece(startRow, startCol, row, col, (newBoard) => {
                board = newBoard; // Update main board state

                const movedPieceChar = board[row][col]; // Get the actual piece after move
                // Check for pawn promotion
                if ((movedPieceChar === 'p' && row === 0) || (movedPieceChar === 'P' && row === 7)) {
                    showPromotionDialog(row, col, movedPieceChar === 'p');
                } else {
                    checkGameEnd();
                    if (gameOverOverlay.style.display === 'none') { // Only switch if game not over
                        switchPlayer();
                    }
                }
            });
            clearSelectionAndMoves();
        } else {
            clearSelectionAndMoves();
            if (isPlayersPiece) {
                selectPiece(clickedSquare);
            }
        }
    } else {
        if (isPlayersPiece) {
            selectPiece(clickedSquare);
        }
    }
}

function selectPiece(squareElement) {
    clearSelectionAndMoves();
    squareElement.classList.add('selected');
    selectedSquare = squareElement;
    showPossibleMoves(parseInt(squareElement.dataset.row), parseInt(squareElement.dataset.col));
}

function clearSelectionAndMoves() {
    if (selectedSquare) {
        selectedSquare.classList.remove('selected');
    }
    selectedSquare = null;
    document.querySelectorAll('.possible-move').forEach(square => {
        square.classList.remove('possible-move');
    });
}

// --- Chess Logic Core (isValidMove, etc.) ---

function isOccupiedByAlly(targetRow, targetCol, isWhite, currentBoard) {
    const targetPiece = currentBoard[targetRow][targetCol];
    if (!targetPiece) return false;
    const isTargetWhite = targetPiece === targetPiece.toLowerCase();
    return (isWhite && isTargetWhite) || (!isWhite && !isTargetWhite);
}

function isWithinBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Function to check if a square is attacked by opponent pieces
// This is a CRUCIAL, but complex, function for full chess logic.
// This version is a simplified placeholder. A full implementation would iterate
// through all opponent pieces and check if any of their valid moves (from opponent's perspective)
// can target the given square. This often involves temporarily removing the king to avoid infinite recursion
// in check detection.
function isSquareAttacked(row, col, byWhitePlayer, currentBoard) {
    const opponentColor = byWhitePlayer ? 'black' : 'white';
    
    // Check for attacks from all directions/piece types
    // For simplicity, we'll check common attacks. A full check involves more.
    
    // Pawn attacks
    const pawnDirection = byWhitePlayer ? 1 : -1; // Pawns attack opposite direction
    if (isWithinBoard(row + pawnDirection, col + 1)) {
        const piece = currentBoard[row + pawnDirection][col + 1];
        if (piece && piece.toLowerCase() === 'p' && ((byWhitePlayer && piece === 'P') || (!byWhitePlayer && piece === 'p'))) {
            return true;
        }
    }
    if (isWithinBoard(row + pawnDirection, col - 1)) {
        const piece = currentBoard[row + pawnDirection][col - 1];
        if (piece && piece.toLowerCase() === 'p' && ((byWhitePlayer && piece === 'P') || (!byWhitePlayer && piece === 'p'))) {
            return true;
        }
    }

    // Knight attacks (L-shape)
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of knightMoves) {
        const tr = row + dr;
        const tc = col + dc;
        if (isWithinBoard(tr, tc)) {
            const piece = currentBoard[tr][tc];
            if (piece && piece.toLowerCase() === 'n' && ((byWhitePlayer && piece === 'P') || (!byWhitePlayer && piece === 'p'))) {
                return true;
            }
        }
    }

    // Rook/Queen straight-line attacks
    const straightLines = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of straightLines) {
        for (let i = 1; i < 8; i++) {
            const tr = row + dr * i;
            const tc = col + dc * i;
            if (!isWithinBoard(tr, tc)) break;
            const piece = currentBoard[tr][tc];
            if (piece) {
                if (piece.toLowerCase() === 'r' || piece.toLowerCase() === 'q') {
                    if ((byWhitePlayer && piece === 'R') || (byWhitePlayer && piece === 'Q') || (!byWhitePlayer && piece === 'r') || (!byWhitePlayer && piece === 'q')) {
                        return true;
                    }
                }
                break; // Blocked by another piece
            }
        }
    }

    // Bishop/Queen diagonal attacks
    const diagonals = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dr, dc] of diagonals) {
        for (let i = 1; i < 8; i++) {
            const tr = row + dr * i;
            const tc = col + dc * i;
            if (!isWithinBoard(tr, tc)) break;
            const piece = currentBoard[tr][tc];
            if (piece) {
                if (piece.toLowerCase() === 'b' || piece.toLowerCase() === 'q') {
                     if ((byWhitePlayer && piece === 'B') || (byWhitePlayer && piece === 'Q') || (!byWhitePlayer && piece === 'b') || (!byWhitePlayer && piece === 'q')) {
                        return true;
                    }
                }
                break; // Blocked by another piece
            }
        }
    }

    // King attacks (1 square around) - important for king safety checks
    const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dr, dc] of kingMoves) {
        const tr = row + dr;
        const tc = col + dc;
        if (isWithinBoard(tr, tc)) {
            const piece = currentBoard[tr][tc];
            if (piece && piece.toLowerCase() === 'k' && ((byWhitePlayer && piece === 'K') || (!byWhitePlayer && piece === 'k'))) {
                return true;
            }
        }
    }
    return false;
}

// Function to check if the current player's king is in check on a given board state
function isKingInCheck(currentBoard, playerColor) {
    let kingRow, kingCol;
    const kingPiece = playerColor === 'white' ? 'k' : 'K';

    // Find the king's position
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c] === kingPiece) {
                kingRow = r;
                kingCol = c;
                break;
            }
        }
        if (kingRow !== undefined) break;
    }

    if (kingRow === undefined) {
        // This should theoretically not happen if the game is set up correctly
        console.warn(`King for ${playerColor} not found!`);
        return false;
    }

    // Check if the king's square is attacked by the opposing player
    return isSquareAttacked(kingRow, kingCol, playerColor === 'white' ? false : true, currentBoard);
}


// Validates a move on a given board state.
// Crucially, this now takes `currentBoard` and `playerTurn` as arguments.
// It also checks if the move leaves the king in check.
function isValidMove(startRow, startCol, endRow, endCol, currentBoard, playerTurn) {
    if (!isWithinBoard(startRow, startCol) || !isWithinBoard(endRow, endCol)) {
        return false;
    }

    const piece = currentBoard[startRow][startCol];
    if (!piece) return false;

    const isWhite = piece === piece.toLowerCase();
    const isCurrentPlayerWhite = playerTurn === 'white';

    // Ensure the piece belongs to the current player
    if ((isWhite && !isCurrentPlayerWhite) || (!isWhite && isCurrentPlayerWhite)) {
        return false;
    }

    if (startRow === endRow && startCol === endCol) {
        return false;
    }

    // Temporarily make the move on a copy of the board to check if it results in check
    let tempBoard = JSON.parse(JSON.stringify(currentBoard));
    const capturedPiece = tempBoard[endRow][endCol];
    tempBoard[endRow][endCol] = piece;
    tempBoard[startRow][startCol] = '';

    // Handle En Passant special case for temp board check
    let actualCapturedPieceForEnPassant = null;
    if (piece.toLowerCase() === 'p' && enPassantTargetSquare && endRow === enPassantTargetSquare[0] && endCol === enPassantTargetSquare[1] && capturedPiece === '') {
        const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
        actualCapturedPieceForEnPassant = tempBoard[capturedPawnRow][endCol];
        tempBoard[capturedPawnRow][endCol] = '';
    }

    // Handle Castling Rook Movement special case for temp board check
    if (piece.toLowerCase() === 'k' && Math.abs(startCol - endCol) === 2) {
        if (endCol === 6) { // Kingside Castling
            tempBoard[startRow][5] = tempBoard[startRow][7];
            tempBoard[startRow][7] = '';
        } else if (endCol === 2) { // Queenside Castling
            tempBoard[startRow][3] = tempBoard[startRow][0];
            tempBoard[startRow][0] = '';
        }
    }


    // Check if moving the piece leaves the king in check
    if (isKingInCheck(tempBoard, playerTurn)) {
        return false; // Cannot make a move that leaves your king in check
    }

    // Revert temp board if needed (not strictly necessary but good for clarity)
    tempBoard[startRow][startCol] = piece;
    tempBoard[endRow][endCol] = capturedPiece;
    if (actualCapturedPieceForEnPassant) {
        const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
        tempBoard[capturedPawnRow][endCol] = actualCapturedPieceForEnPassant;
    }
    // No need to revert rook for castling in tempBoard as it will be discarded

    // Now, apply specific piece movement rules for the actual move (ignoring check for now)
    if (isOccupiedByAlly(endRow, endCol, isWhite, currentBoard)) {
        return false;
    }

    switch (piece.toLowerCase()) {
        case 'p': // Pawn
            const direction = isWhite ? -1 : 1;
            const startRank = isWhite ? 6 : 1;

            // Move 1 square forward
            if (endCol === startCol && endRow === startRow + direction && currentBoard[endRow][endCol] === '') {
                return true;
            }
            // Move 2 squares forward (first move only)
            if (endCol === startCol && startRow === startRank && endRow === startRow + 2 * direction &&
                currentBoard[endRow][endCol] === '' && currentBoard[startRow + direction][startCol] === '') {
                return true;
            }
            // Diagonal capture
            if (Math.abs(endCol - startCol) === 1 && endRow === startRow + direction && currentBoard[endRow][endCol] !== '') {
                return true;
            }
            // En Passant
            if (Math.abs(endCol - startCol) === 1 && endRow === startRow + direction &&
                enPassantTargetSquare && enPassantTargetSquare[0] === endRow && enPassantTargetSquare[1] === endCol) {
                // Check if the captured pawn is actually there (should be in the square BEHIND the target)
                const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
                const capturedPawn = currentBoard[capturedPawnRow][endCol];
                if (capturedPawn && ((isWhite && capturedPawn === 'P') || (!isWhite && capturedPawn === 'p'))) {
                    return true;
                }
            }
            return false;

        case 'r': // Rook
            return isValidMoveRookLike(startRow, startCol, endRow, endCol, currentBoard);

        case 'n': // Knight
            const rowDiffK = Math.abs(startRow - endRow);
            const colDiffK = Math.abs(startCol - endCol);
            return (rowDiffK === 2 && colDiffK === 1) || (rowDiffK === 1 && colDiffK === 2);

        case 'b': // Bishop
            return isValidMoveBishopLike(startRow, startCol, endRow, endCol, currentBoard);

        case 'q': // Queen
            return isValidMoveRookLike(startRow, startCol, endRow, endCol, currentBoard) ||
                   isValidMoveBishopLike(startRow, startCol, endRow, endCol, currentBoard);

        case 'k': // King
            const rowDiffKing = Math.abs(startRow - endRow);
            const colDiffKing = Math.abs(startCol - endCol);

            // Normal 1-square move
            if (rowDiffKing <= 1 && colDiffKing <= 1 && (rowDiffKing + colDiffKing > 0)) {
                // This 'isSquareAttacked' here is important to prevent king from moving INTO check.
                // It checks the *destination* square.
                if (!isSquareAttacked(endRow, endCol, isWhite ? false : true, currentBoard)) {
                    return true;
                }
                return false; // King moves into attacked square
            }

            // Castling
            if (rowDiffKing === 0 && Math.abs(colDiffKing) === 2) { // Horizontal move of 2 squares
                // Check if king has moved and rook has moved
                let canCastle = false;
                if (isWhite) {
                    if (startRow === 7 && startCol === 4) { // White King's starting position
                        if (endCol === 6 && canWhiteCastleKingSide) { // Kingside castling
                            // Check if squares are empty (f1, g1) and rook is present (h1)
                            if (currentBoard[7][5] === '' && currentBoard[7][6] === '' && currentBoard[7][7] === 'r') {
                                // Check if king is not in check, and squares it passes through/lands on are not attacked
                                if (!isKingInCheck(currentBoard, 'white') &&
                                    !isSquareAttacked(7, 4, true, currentBoard) && // Current King pos
                                    !isSquareAttacked(7, 5, true, currentBoard) && // f1
                                    !isSquareAttacked(7, 6, true, currentBoard)) { // g1
                                    canCastle = true;
                                }
                            }
                        } else if (endCol === 2 && canWhiteCastleQueenSide) { // Queenside castling
                            // Check if squares are empty (b1, c1, d1) and rook is present (a1)
                            if (currentBoard[7][1] === '' && currentBoard[7][2] === '' && currentBoard[7][3] === '' && currentBoard[7][0] === 'r') {
                                // Check if king is not in check, and squares it passes through/lands on are not attacked
                                if (!isKingInCheck(currentBoard, 'white') &&
                                    !isSquareAttacked(7, 4, true, currentBoard) && // Current King pos
                                    !isSquareAttacked(7, 3, true, currentBoard) && // d1
                                    !isSquareAttacked(7, 2, true, currentBoard)) { // c1
                                    canCastle = true;
                                }
                            }
                        }
                    }
                } else { // Black King
                    if (startRow === 0 && startCol === 4) { // Black King's starting position
                        if (endCol === 6 && canBlackCastleKingSide) { // Kingside castling
                            if (currentBoard[0][5] === '' && currentBoard[0][6] === '' && currentBoard[0][7] === 'R') {
                                if (!isKingInCheck(currentBoard, 'black') &&
                                    !isSquareAttacked(0, 4, false, currentBoard) &&
                                    !isSquareAttacked(0, 5, false, currentBoard) &&
                                    !isSquareAttacked(0, 6, false, currentBoard)) {
                                    canCastle = true;
                                }
                            }
                        } else if (endCol === 2 && canBlackCastleQueenSide) { // Queenside castling
                            if (currentBoard[0][1] === '' && currentBoard[0][2] === '' && currentBoard[0][3] === '' && currentBoard[0][0] === 'R') {
                                if (!isKingInCheck(currentBoard, 'black') &&
                                    !isSquareAttacked(0, 4, false, currentBoard) &&
                                    !isSquareAttacked(0, 3, false, currentBoard) &&
                                    !isSquareAttacked(0, 2, false, currentBoard)) {
                                    canCastle = true;
                                }
                            }
                        }
                    }
                }
                return canCastle;
            }
            return false;

        default:
            return false;
    }
}


function isValidMoveRookLike(startRow, startCol, endRow, endCol, currentBoard) {
    if (startRow === endRow) { // Horizontal
        const step = (endCol > startCol) ? 1 : -1;
        for (let c = startCol + step; c !== endCol; c += step) {
            if (currentBoard[startRow][c] !== '') return false;
        }
        return true;
    }
    if (startCol === endCol) { // Vertical
        const step = (endRow > startRow) ? 1 : -1;
        for (let r = startRow + step; r !== endRow; r += step) {
            if (currentBoard[r][startCol] !== '') return false;
        }
        return true;
    }
    return false;
}

function isValidMoveBishopLike(startRow, startCol, endRow, endCol, currentBoard) {
    if (Math.abs(startRow - endRow) === Math.abs(startCol - endCol)) { // Diagonal
        const rowStep = (endRow > startRow) ? 1 : -1;
        const colStep = (endCol > startCol) ? 1 : -1;
        let r = startRow + rowStep;
        let c = startCol + colStep;
        while (r !== endRow) {
            if (currentBoard[r][c] !== '') return false;
            r += rowStep;
            c += colStep;
        }
        return true;
    }
    return false;
}

function showPossibleMoves(startRow, startCol) {
    clearPossibleMoves();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(startRow, startCol, r, c, board, currentPlayer)) {
                const square = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (square) {
                    square.classList.add('possible-move');
                }
            }
        }
    }
}

// --- Animation and Special Moves ---

function movePiece(startRow, startCol, endRow, endCol, callback) {
    const pieceToMove = board[startRow][startCol];
    const pieceType = pieceToMove.toLowerCase();
    const isWhite = pieceToMove === pieceToMove.toLowerCase();

    // Create a temporary board for animation and initial data update
    let newBoardState = JSON.parse(JSON.stringify(board));

    // Handle Castling Rook Movement on the newBoardState
    if (pieceType === 'k' && Math.abs(startCol - endCol) === 2) {
        if (endCol === 6) { // Kingside Castling
            newBoardState[startRow][5] = newBoardState[startRow][7];
            newBoardState[startRow][7] = '';
        } else if (endCol === 2) { // Queenside Castling
            newBoardState[startRow][3] = newBoardState[startRow][0];
            newBoardState[startRow][0] = '';
        }
    }

    // Handle En Passant Capture on the newBoardState
    let capturedPawnForEnPassant = null;
    if (pieceType === 'p' && enPassantTargetSquare && endRow === enPassantTargetSquare[0] && endCol === enPassantTargetSquare[1] && newBoardState[endRow][endCol] === '') {
        const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
        capturedPawnForEnPassant = newBoardState[capturedPawnRow][endCol]; // Store for potential undo/debug
        newBoardState[capturedPawnRow][endCol] = '';
    }

    // Temporarily apply the main piece move to newBoardState for animation setup
    newBoardState[endRow][endCol] = pieceToMove;
    newBoardState[startRow][startCol] = '';


    // Animate the main piece movement
    const startSquare = document.querySelector(`[data-row="${startRow}"][data-col="${startCol}"]`);
    const endSquare = document.querySelector(`[data-row="${endRow}"][data-col="${endCol}"]`);
    const pieceElement = startSquare.querySelector('.piece');

    if (!pieceElement) { // Fallback if piece element somehow isn't found (shouldn't happen often)
        callback(newBoardState); // Just update board data immediately
        return;
    }

    // Clone the piece for animation to avoid conflicts with re-rendering original square
    const animatingPiece = pieceElement.cloneNode(true);
    animatingPiece.style.position = 'absolute';
    animatingPiece.style.zIndex = '20';
    animatingPiece.style.pointerEvents = 'none'; // Don't block clicks

    // Get board's top-left for absolute positioning
    const boardRect = chessboard.getBoundingClientRect();
    const startRect = startSquare.getBoundingClientRect();
    const endRect = endSquare.getBoundingClientRect();

    animatingPiece.style.left = `${startRect.left - boardRect.left}px`;
    animatingPiece.style.top = `${startRect.top - boardRect.top}px`;

    chessboard.appendChild(animatingPiece);
    pieceElement.remove(); // Remove original piece from its square immediately

    // Trigger CSS transition for animation
    requestAnimationFrame(() => {
        const deltaX = (endRect.left - startRect.left);
        const deltaY = (endRect.top - startRect.top);
        animatingPiece.style.transition = `transform 0.3s ease-out`;
        animatingPiece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });

    // After animation, finalize the board state and trigger callback
    setTimeout(() => {
        animatingPiece.remove(); // Remove the animating clone

        // Update global game state variables based on the final move
        // These need to reflect the state *after* the move
        enPassantTargetSquare = null;
        if (pieceType === 'p' && Math.abs(startRow - endRow) === 2) {
            enPassantTargetSquare = [isWhite ? endRow + 1 : endRow - 1, endCol];
        }

        if (pieceType === 'k') {
            if (isWhite) {
                canWhiteCastleKingSide = false;
                canWhiteCastleQueenSide = false;
            } else {
                canBlackCastleKingSide = false;
                canBlackCastleQueenSide = false;
            }
        } else if (pieceType === 'r') {
            if (isWhite) {
                if (startRow === 7 && startCol === 7) canWhiteCastleKingSide = false;
                if (startRow === 7 && startCol === 0) canWhiteCastleQueenSide = false;
            } else {
                if (startRow === 0 && startCol === 7) canBlackCastleKingSide = false;
                if (startRow === 0 && startCol === 0) canBlackCastleQueenSide = false;
            }
        }
        callback(newBoardState); // Pass the updated board state
        renderBoard(); // Re-render the board to reflect the new state permanently
    }, 300); // Match CSS transition duration
}


// --- Promotion Logic ---

function showPromotionDialog(row, col, isWhitePawn) {
    promotionOptionsDiv.innerHTML = '';
    const options = ['q', 'r', 'b', 'n']; // Queen, Rook, Bishop, Knight
    const promoteToColor = isWhitePawn ? (pieceType) => pieceType : (pieceType) => pieceType.toUpperCase();

    options.forEach(pieceType => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('promotion-option');
        optionDiv.innerHTML = pieces[promoteToColor(pieceType)];
        optionDiv.dataset.piece = promoteToColor(pieceType);
        optionDiv.addEventListener('click', () => {
            promotePawn(row, col, optionDiv.dataset.piece);
            promotionOverlay.style.display = 'none';
            checkGameEnd(); // Check for game end after promotion
            if (gameOverOverlay.style.display === 'none') {
                switchPlayer(); // Only switch if game not over
            }
        });
        promotionOptionsDiv.appendChild(optionDiv);
    });

    promotionOverlay.style.display = 'flex';
}

function promotePawn(row, col, newPieceChar) {
    board[row][col] = newPieceChar;
    renderBoard();
}

// --- Game End Logic ---

function checkGameEnd() {
    const opponentPlayer = currentPlayer === 'white' ? 'black' : 'white';

    // Get all possible moves for the opponent
    const opponentPossibleMoves = getAllPossibleMoves(board, opponentPlayer);

    if (opponentPossibleMoves.length === 0) {
        if (isKingInCheck(board, opponentPlayer)) {
            // Opponent has no legal moves AND their king is in check -> Checkmate!
            displayGameOver(currentPlayer === 'white' ? 'White' : 'Black', 'checkmate');
        } else {
            // Opponent has no legal moves AND their king is NOT in check -> Stalemate!
            displayGameOver('Draw', 'stalemate');
        }
    } else if (!findKing(board, 'K') || !findKing(board, 'k')) {
         // This is a crude check for king removal (e.g. if king was captured)
        displayGameOver(currentPlayer === 'white' ? 'White' : 'Black', 'King Captured (Invalid Game State)');
    }
    // Add more draw conditions here (e.g., insufficient material, 50-move rule, threefold repetition)
}


function displayGameOver(winner, reason) {
    let message = '';
    let details = '';
    if (winner === 'Draw') {
        message = 'GAME BERAKHIR SERI!';
        details = `Alasan: ${reason}`;
        gameOverMessage.style.color = 'var(--accent-color)';
    } else {
        message = `${winner} MENANG!`;
        details = `Alasan: ${reason}`;
        gameOverMessage.style.color = winner === 'White' ? 'var(--win-color)' : 'var(--lose-color)';
    }

    gameOverMessage.textContent = message;
    gameOverDetails.textContent = details;
    gameOverOverlay.style.display = 'flex';
}

// Helper to find a king's position (for simplified checkmate/stalemate)
function findKing(currentBoard, kingChar) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c] === kingChar) {
                return [r, c];
            }
        }
    }
    return null; // King not found
}

// Gets all possible legal moves for a given player on a given board
function getAllPossibleMoves(currentBoard, playerColor) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = currentBoard[r][c];
            if (piece) {
                const isWhitePiece = piece === piece.toLowerCase();
                const isCurrentPlayerWhite = playerColor === 'white';

                if ((isWhitePiece && isCurrentPlayerWhite) || (!isWhitePiece && !isCurrentPlayerWhite)) {
                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            if (isValidMove(r, c, tr, tc, currentBoard, playerColor)) {
                                moves.push({ startRow: r, startCol: c, endRow: tr, endCol: tc, piece: piece });
                            }
                        }
                    }
                }
            }
        }
    }
    return moves;
}

// --- Bot Logic (Improved, but still basic) ---

function switchPlayer() {
    currentPlayer = (currentPlayer === 'white') ? 'black' : 'white';
    updateTurnIndicator();

    if (currentPlayer === 'black') {
        // Wait for board to finish rendering before bot moves
        setTimeout(() => {
            botMove();
        }, 500); // Give a bit more time for rendering after player's move
    }
}

function botMove() {
    console.log("Bot's turn...");
    const possibleMoves = getAllPossibleMoves(board, 'black');

    if (possibleMoves.length > 0) {
        // Simple evaluation: prefer captures, then random
        let bestMove = null;
        let bestScore = -Infinity; // Higher score is better

        for (const move of possibleMoves) {
            let score = 0;
            const targetPiece = board[move.endRow][move.endCol];

            // Prioritize captures
            if (targetPiece) {
                // Assign arbitrary points for captured pieces
                switch (targetPiece.toLowerCase()) {
                    case 'q': score += 900; break;
                    case 'r': score += 500; break;
                    case 'b': // Fallthrough
                    case 'n': score += 300; break;
                    case 'p': score += 100; break;
                    // King is not captured, but if it were, it'd be game end
                }
            }

            // If it's a capture, or if this is the first move evaluated, make it the best
            if (score > bestScore || bestMove === null) {
                bestScore = score;
                bestMove = move;
            } else if (score === bestScore) {
                // If scores are equal, randomly pick one to add some variety
                if (Math.random() < 0.5) {
                    bestMove = move;
                }
            }
        }

        // Fallback to a completely random move if no capturing moves (or if logic above didn't pick one)
        if (!bestMove) {
            bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }

        // Execute the chosen move
        movePiece(bestMove.startRow, bestMove.startCol, bestMove.endRow, bestMove.endCol, (newBoard) => {
            board = newBoard; // Update main board state

            // Handle Bot's Pawn Promotion (always to Queen for simplicity)
            const movedPieceChar = board[bestMove.endRow][bestMove.endCol];
            if (movedPieceChar === 'P' && bestMove.endRow === 7) {
                board[bestMove.endRow][bestMove.endCol] = 'Q'; // Promote to Queen
                renderBoard(); // Re-render immediately after promotion
            }

            checkGameEnd();
            if (gameOverOverlay.style.display === 'none') {
                switchPlayer();
            }
        });

    } else {
        // Bot has no legal moves
        checkGameEnd(); // Determine if it's checkmate or stalemate for bot
    }
}


// Initialize the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeBoard);
