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
let selectedSquare = null; // Stores the DOM element of the currently selected square (for click/tap)
let enPassantTargetSquare = null; // Stores [row, col] of the square behind a pawn that moved two squares
let canWhiteCastleKingSide = true;
let canWhiteCastleQueenSide = true;
let canBlackCastleKingSide = true;
let canBlackCastleQueenSide = true;
let fiftyMoveRuleCounter = 0; // Increments with each move, resets on pawn move or capture
let history = []; // Stores board states for threefold repetition

// Stores coordinates for pawn promotion: [startRow, startCol, endRow, endCol]
let pendingPromotionMove = null;

// Unicode Chess Pieces (White are lowercase, Black are uppercase)
const pieces = {
    'R': '&#9814;', 'N': '&#9816;', 'B': '&#9815;', 'Q': '&#9813;', 'K': '&#9812;', 'P': '&#9817;', // Black
    'r': '&#9820;', 'n': '&#9822;', 'b': '&#9821;', 'q': '&#9819;', 'k': '&#9818;', 'p': '&#9823;'  // White
};

// Piece values for evaluation (Black pieces will have negative values from White's perspective)
const pieceValues = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000, // White pieces
    'P': -100, 'N': -320, 'B': -330, 'R': -500, 'Q': -900, 'K': -20000 // Black pieces
};

// Depth for Minimax search (adjust for difficulty, higher is slower)
const DEPTH_LIMIT = 3; // Try 2 or 3 for a noticeable difference. 4+ might be very slow.

// --- Drag and Drop Variables for Touch/Mouse ---
let draggedPiece = null;
let currentDraggingPieceElement = null; // The piece element currently being dragged
let initialX, initialY; // Initial touch/mouse position
let offsetX, offsetY; // Offset from touch/mouse to piece top-left
let originalPieceParent = null; // To put the piece back if drag is invalid
let dragStartSquare = null; // The square element where the drag started

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
    fiftyMoveRuleCounter = 0;
    history = [];
    pendingPromotionMove = null;

    promotionOverlay.style.display = 'none';
    gameOverOverlay.style.display = 'none';

    updateTurnIndicator();
    renderBoard();
    addBoardStateToHistory(); // Add initial board state to history
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
                // Add event listeners for both mouse and touch for drag-and-drop
                pieceElement.addEventListener('mousedown', handleDragStart);
                pieceElement.addEventListener('touchstart', handleDragStart);
                square.appendChild(pieceElement);
            }
            // Add click listener for selecting and moving (alternative to drag)
            square.addEventListener('click', handleSquareClick);
            chessboard.appendChild(square);
        }
    }
}

function updateTurnIndicator() {
    if (currentPlayer === 'white') {
        whiteTurnIndicator.textContent = 'Giliran Anda';
        blackTurnIndicator.textContent = 'Menunggu';
    } else {
        whiteTurnIndicator.textContent = 'Menunggu';
        blackTurnIndicator.textContent = 'Giliran Bot';
    }
}

// --- Player Interaction (Click/Tap) ---

function handleSquareClick(event) {
    if (currentPlayer === 'black' || promotionOverlay.style.display === 'flex' || gameOverOverlay.style.display === 'flex') {
        console.log("Not player's turn or game state preventing action.");
        return;
    }

    // If a drag operation was just completed, prevent a click event from firing immediately
    if (draggedPiece) {
        draggedPiece = null; // Clear dragged piece immediately
        return; // Prevent click handling after a drag
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
        } else if (isValidMove(startRow, startCol, row, col, board, currentPlayer, {
            enPassantTarget: enPassantTargetSquare,
            canWhiteCastleKing: canWhiteCastleKingSide,
            canWhiteCastleQueen: canWhiteCastleQueenSide,
            canBlackCastleKing: canBlackCastleKingSide,
            canBlackCastleQueen: canBlackCastleQueenSide
        })) {
            pendingPromotionMove = [startRow, startCol, row, col];
            
            // Execute the move visually and update board data in callback
            // Pass current state to movePiece for proper state updates
            movePiece(startRow, startCol, row, col, (newBoard) => {
                board = newBoard; // Update main board state

                const movedPieceChar = board[row][col]; // Get the actual piece after move
                // Check for pawn promotion
                if ((movedPieceChar === 'p' && row === 0) || (movedPieceChar === 'P' && row === 7)) {
                    showPromotionDialog(row, col, movedPieceChar === 'p');
                } else {
                    addBoardStateToHistory();
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

// --- Drag and Drop Logic (for both mouse and touch) ---

function getEventCoords(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handleDragStart(e) {
    if (currentPlayer === 'black' || promotionOverlay.style.display === 'flex' || gameOverOverlay.style.display === 'flex') {
        return; // Don't allow drag if not player's turn or during overlays
    }
    e.preventDefault(); // Prevent default touch behavior (e.g., scrolling)

    currentDraggingPieceElement = e.target;
    const pieceChar = currentDraggingPieceElement.parentNode.dataset.piece || board[parseInt(currentDraggingPieceElement.parentNode.dataset.row)][parseInt(currentDraggingPieceElement.parentNode.dataset.col)];
    const isPlayersPiece = pieceChar && pieceChar === pieceChar.toLowerCase();

    if (!isPlayersPiece) {
        currentDraggingPieceElement = null; // Only allow dragging own pieces
        return;
    }

    draggedPiece = currentDraggingPieceElement;
    originalPieceParent = draggedPiece.parentNode;
    dragStartSquare = originalPieceParent;

    const coords = getEventCoords(e);
    initialX = coords.x;
    initialY = coords.y;

    const rect = draggedPiece.getBoundingClientRect();
    offsetX = coords.x - rect.left;
    offsetY = coords.y - rect.top;

    draggedPiece.classList.add('dragging');
    draggedPiece.style.left = `${rect.left}px`;
    draggedPiece.style.top = `${rect.top}px`;

    chessboard.appendChild(draggedPiece); // Append to chessboard to keep within its bounds for simpler positioning

    showPossibleMoves(parseInt(dragStartSquare.dataset.row), parseInt(dragStartSquare.dataset.col));

    // Add global listeners for dragging and dropping
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd); // Handle cases where touch is interrupted
}

function handleDrag(e) {
    if (!draggedPiece) return;
    e.preventDefault(); // Prevent scrolling while dragging

    const coords = getEventCoords(e);
    const boardRect = chessboard.getBoundingClientRect();
    draggedPiece.style.left = `${coords.x - offsetX - boardRect.left}px`;
    draggedPiece.style.top = `${coords.y - offsetY - boardRect.top}px`;
}

function handleDragEnd(e) {
    if (!draggedPiece) return;

    draggedPiece.classList.remove('dragging');

    // Remove global listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
    document.removeEventListener('touchcancel', handleDragEnd);


    const endCoords = getEventCoords(e);
    // Find the square where the piece was dropped
    const targetSquareElement = document.elementFromPoint(endCoords.x, endCoords.y);

    let droppedOnValidSquare = false;
    let endRow, endCol;

    const targetSquare = targetSquareElement ? targetSquareElement.closest('.square') : null;

    if (targetSquare) {
        endRow = parseInt(targetSquare.dataset.row);
        endCol = parseInt(targetSquare.dataset.col);

        const startRow = parseInt(dragStartSquare.dataset.row);
        const startCol = parseInt(dragStartSquare.dataset.col);

        if (isValidMove(startRow, startCol, endRow, endCol, board, currentPlayer, {
            enPassantTarget: enPassantTargetSquare,
            canWhiteCastleKing: canWhiteCastleKingSide,
            canWhiteCastleQueen: canWhiteCastleQueenSide,
            canBlackCastleKing: canBlackCastleKingSide,
            canBlackCastleQueen: canBlackCastleQueenSide
        })) {
            pendingPromotionMove = [startRow, startCol, endRow, endCol];

            // Use the movePiece function with a direct board update
            movePiece(startRow, startCol, endRow, endCol, (newBoard) => {
                board = newBoard; // Update main board state

                const movedPieceChar = board[endRow][endCol];
                if ((movedPieceChar === 'p' && endRow === 0) || (movedPieceChar === 'P' && endRow === 7)) {
                    showPromotionDialog(endRow, endCol, movedPieceChar === 'p');
                } else {
                    addBoardStateToHistory();
                    checkGameEnd();
                    if (gameOverOverlay.style.display === 'none') {
                        switchPlayer();
                    }
                }
            });
            droppedOnValidSquare = true;
        }
    }

    if (!droppedOnValidSquare) {
        renderBoard(); // Re-render to put the piece back to its original square visually
    }
    
    draggedPiece = null; // Reset for next drag
    currentDraggingPieceElement = null;
    originalPieceParent = null;
    dragStartSquare = null;
    clearSelectionAndMoves(); // Also clear any visual cues from selection
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
// byWhitePlayer: True if checking attacks BY white pieces, False if BY black pieces
function isSquareAttacked(row, col, byWhitePlayer, currentBoard) {
    // Determine the opponent's pieces' case (uppercase for black, lowercase for white)
    const attackerPawn = byWhitePlayer ? 'p' : 'P';
    const attackerKnight = byWhitePlayer ? 'n' : 'N';
    const attackerBishop = byWhitePlayer ? 'b' : 'B';
    const attackerRook = byWhitePlayer ? 'r' : 'R';
    const attackerQueen = byWhitePlayer ? 'q' : 'Q';
    const attackerKing = byWhitePlayer ? 'k' : 'K';
    
    // Check for attacks from all directions/piece types
    
    // Pawn attacks
    const pawnDirection = byWhitePlayer ? -1 : 1; // Pawns attack forward
    if (isWithinBoard(row + pawnDirection, col + 1)) {
        if (currentBoard[row + pawnDirection][col + 1] === attackerPawn) {
            return true;
        }
    }
    if (isWithinBoard(row + pawnDirection, col - 1)) {
        if (currentBoard[row + pawnDirection][col - 1] === attackerPawn) {
            return true;
        }
    }

    // Knight attacks (L-shape)
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of knightMoves) {
        const tr = row + dr;
        const tc = col + dc;
        if (isWithinBoard(tr, tc)) {
            if (currentBoard[tr][tc] === attackerKnight) {
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
                if (piece === attackerRook || piece === attackerQueen) {
                    return true;
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
                if (piece === attackerBishop || piece === attackerQueen) {
                    return true;
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
            if (currentBoard[tr][tc] === attackerKing) {
                return true;
            }
        }
    }
    return false;
}

// Function to check if the current player's king is in check on a given board state
function isKingInCheck(currentBoard, playerColor, stateData) {
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
        // This can happen in hypothetical board states during minimax search if a king is captured.
        // It generally means the side whose king is missing has been mated, or the state is invalid.
        // For check, we can return false as the king is not on the board to be checked.
        return false;
    }

    // Check if the king's square is attacked by the opposing player
    // The `byWhitePlayer` argument for `isSquareAttacked` refers to the attacking side.
    // So, if we're checking for check on a 'white' king, the attacking pieces are 'black',
    // meaning `byWhitePlayer` should be `false` (attacking *by* black pieces).
    return isSquareAttacked(kingRow, kingCol, playerColor === 'white' ? false : true, currentBoard);
}


// Validates a move on a given board state.
// stateData object includes: enPassantTarget, canWhiteCastleKing, canWhiteCastleQueen, canBlackCastleKing, canBlackCastleQueen
function isValidMove(startRow, startCol, endRow, endCol, currentBoard, playerTurn, stateData) {
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

    // First, check basic piece movement rules (capturing ally pieces is handled here)
    if (isOccupiedByAlly(endRow, endCol, isWhite, currentBoard)) {
        return false;
    }

    let moveIsValidByPieceRules = false;
    let isCastlingMove = false;
    let isEnPassantCapture = false;

    switch (piece.toLowerCase()) {
        case 'p': // Pawn
            const direction = isWhite ? -1 : 1;
            const startRank = isWhite ? 6 : 1;

            // Move 1 square forward
            if (endCol === startCol && endRow === startRow + direction && currentBoard[endRow][endCol] === '') {
                moveIsValidByPieceRules = true;
            }
            // Move 2 squares forward (first move only)
            else if (endCol === startCol && startRow === startRank && endRow === startRow + 2 * direction &&
                currentBoard[endRow][endCol] === '' && currentBoard[startRow + direction][startCol] === '') {
                moveIsValidByPieceRules = true;
            }
            // Diagonal capture
            else if (Math.abs(endCol - startCol) === 1 && endRow === startRow + direction && currentBoard[endRow][endCol] !== '') {
                moveIsValidByPieceRules = true;
            }
            // En Passant
            else if (Math.abs(endCol - startCol) === 1 && endRow === startRow + direction &&
                stateData.enPassantTarget && stateData.enPassantTarget[0] === endRow && stateData.enPassantTarget[1] === endCol) {
                const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
                const capturedPawn = currentBoard[capturedPawnRow][endCol];
                if (capturedPawn && ((isWhite && capturedPawn === 'P') || (!isWhite && capturedPawn === 'p'))) {
                    moveIsValidByPieceRules = true;
                    isEnPassantCapture = true; // Mark as en passant for temp board logic
                }
            }
            break;

        case 'r': // Rook
            moveIsValidByPieceRules = isValidMoveRookLike(startRow, startCol, endRow, endCol, currentBoard);
            break;

        case 'n': // Knight
            const rowDiffK = Math.abs(startRow - endRow);
            const colDiffK = Math.abs(startCol - endCol);
            moveIsValidByPieceRules = (rowDiffK === 2 && colDiffK === 1) || (rowDiffK === 1 && colDiffK === 2);
            break;

        case 'b': // Bishop
            moveIsValidByPieceRules = isValidMoveBishopLike(startRow, startCol, endRow, endCol, currentBoard);
            break;

        case 'q': // Queen
            moveIsValidByPieceRules = isValidMoveRookLike(startRow, startCol, endRow, endCol, currentBoard) ||
                   isValidMoveBishopLike(startRow, startCol, endRow, endCol, currentBoard);
            break;

        case 'k': // King
            const rowDiffKing = Math.abs(startRow - endRow);
            const colDiffKing = Math.abs(startCol - endCol);

            // Normal 1-square move
            if (rowDiffKing <= 1 && colDiffKing <= 1 && (rowDiffKing + colDiffKing > 0)) {
                // Check if king is moving into an attacked square
                if (!isSquareAttacked(endRow, endCol, isWhite ? false : true, currentBoard)) {
                    moveIsValidByPieceRules = true;
                }
            }
            // Castling
            else if (rowDiffKing === 0 && Math.abs(colDiffKing) === 2) { // Horizontal move of 2 squares
                let canCastle = false;
                if (isWhite) {
                    if (startRow === 7 && startCol === 4) { // White King's starting position
                        if (endCol === 6 && stateData.canWhiteCastleKing) { // Kingside castling (g1)
                            if (currentBoard[7][5] === '' && currentBoard[7][6] === '' && currentBoard[7][7] === 'r') {
                                // Check if king is not in check, and squares it passes through/lands on are not attacked
                                if (!isKingInCheck(currentBoard, 'white', stateData) &&
                                    !isSquareAttacked(7, 4, false, currentBoard) && // Current King pos
                                    !isSquareAttacked(7, 5, false, currentBoard) && // f1
                                    !isSquareAttacked(7, 6, false, currentBoard)) { // g1
                                    canCastle = true;
                                }
                            }
                        } else if (endCol === 2 && stateData.canWhiteCastleQueen) { // Queenside castling (c1)
                            if (currentBoard[7][1] === '' && currentBoard[7][2] === '' && currentBoard[7][3] === '' && currentBoard[7][0] === 'r') {
                                if (!isKingInCheck(currentBoard, 'white', stateData) &&
                                    !isSquareAttacked(7, 4, false, currentBoard) &&
                                    !isSquareAttacked(7, 3, false, currentBoard) && // d1
                                    !isSquareAttacked(7, 2, false, currentBoard)) { // c1
                                    canCastle = true;
                                }
                            }
                        }
                    }
                } else { // Black King
                    if (startRow === 0 && startCol === 4) { // Black King's starting position
                        if (endCol === 6 && stateData.canBlackCastleKing) { // Kingside castling (g8)
                            if (currentBoard[0][5] === '' && currentBoard[0][6] === '' && currentBoard[0][7] === 'R') {
                                if (!isKingInCheck(currentBoard, 'black', stateData) &&
                                    !isSquareAttacked(0, 4, true, currentBoard) &&
                                    !isSquareAttacked(0, 5, true, currentBoard) &&
                                    !isSquareAttacked(0, 6, true, currentBoard)) {
                                    canCastle = true;
                                }
                            }
                        } else if (endCol === 2 && stateData.canBlackCastleQueen) { // Queenside castling (c8)
                            if (currentBoard[0][1] === '' && currentBoard[0][2] === '' && currentBoard[0][3] === '' && currentBoard[0][0] === 'R') {
                                if (!isKingInCheck(currentBoard, 'black', stateData) &&
                                    !isSquareAttacked(0, 4, true, currentBoard) &&
                                    !isSquareAttacked(0, 3, true, currentBoard) &&
                                    !isSquareAttacked(0, 2, true, currentBoard)) {
                                    canCastle = true;
                                }
                            }
                        }
                    }
                }
                if (canCastle) {
                    moveIsValidByPieceRules = true;
                    isCastlingMove = true; // Mark as castling for temp board logic
                }
            }
            break;

        default:
            return false; // Should not happen with valid piece types
    }

    if (!moveIsValidByPieceRules) {
        return false;
    }

    // Now, simulate the move to check if it results in check on the king
    let tempBoard = JSON.parse(JSON.stringify(currentBoard));
    
    tempBoard[endRow][endCol] = piece;
    tempBoard[startRow][startCol] = '';

    // Adjust tempBoard for special moves for check validation
    if (isEnPassantCapture) {
        const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
        tempBoard[capturedPawnRow][endCol] = ''; // Remove the captured pawn for en passant
    }
    if (isCastlingMove) {
        if (endCol === 6) { // Kingside Castling
            tempBoard[startRow][5] = tempBoard[startRow][7]; // Move rook
            tempBoard[startRow][7] = ''; // Clear old rook position
        } else if (endCol === 2) { // Queenside Castling
            tempBoard[startRow][3] = tempBoard[startRow][0]; // Move rook
            tempBoard[startRow][0] = ''; // Clear old rook position
        }
    }

    // Check if the current player's king is in check on the temporary board
    if (isKingInCheck(tempBoard, playerTurn, stateData)) {
        return false; // Cannot make a move that leaves your king in check
    }

    return true; // The move is valid
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
            if (isValidMove(startRow, startCol, r, c, board, currentPlayer, {
                enPassantTarget: enPassantTargetSquare,
                canWhiteCastleKing: canWhiteCastleKingSide,
                canWhiteCastleQueen: canWhiteCastleQueenSide,
                canBlackCastleKing: canBlackCastleKingSide,
                canBlackCastleQueen: canBlackCastleQueenSide
            })) {
                const square = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (square) {
                    square.classList.add('possible-move');
                }
            }
        }
    }
}

function clearPossibleMoves() {
    document.querySelectorAll('.possible-move').forEach(square => {
        square.classList.remove('possible-move');
    });
}


// --- Animation and Special Moves ---

function movePiece(startRow, startCol, endRow, endCol, callback) {
    const pieceToMove = board[startRow][startCol];
    const pieceType = pieceToMove.toLowerCase();
    const isWhite = pieceToMove === pieceToMove.toLowerCase();

    // Create a temporary board for animation and initial data update
    let newBoardState = JSON.parse(JSON.stringify(board));
    
    // Check for pawn move or capture for fifty-move rule
    const isPawnMove = pieceType === 'p';
    const isCapture = newBoardState[endRow][endCol] !== '';
    let captureForEnPassant = false;

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
    if (pieceType === 'p' && enPassantTargetSquare && endRow === enPassantTargetSquare[0] && endCol === enPassantTargetSquare[1] && newBoardState[endRow][endCol] === '') {
        const capturedPawnRow = isWhite ? endRow + 1 : endRow - 1;
        newBoardState[capturedPawnRow][endCol] = '';
        captureForEnPassant = true;
    }

    // Temporarily apply the main piece move to newBoardState for animation setup
    newBoardState[endRow][endCol] = pieceToMove;
    newBoardState[startRow][startCol] = '';


    // Animate the main piece movement
    const startSquare = document.querySelector(`[data-row="${startRow}"][data-col="${startCol}"]`);
    const endSquare = document.querySelector(`[data-row="${endRow}"][data-col="${endCol}"]`);
    const pieceElement = startSquare.querySelector('.piece');

    if (!pieceElement) { // Fallback if piece element somehow isn't found (shouldn't happen often)
        // This is a critical fallback, as it skips animation for a potentially missing piece.
        // It's better to ensure pieceElement is always there if the board state is valid.
        console.warn(`Piece element not found at [${startRow}, ${startCol}] for animation.`);
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

        // Update castling rights
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
                if (startRow === 7 && startCol === 7) canWhiteCastleKingSide = false; // White King-side rook
                if (startRow === 7 && startCol === 0) canWhiteCastleQueenSide = false; // White Queen-side rook
            } else {
                if (startRow === 0 && startCol === 7) canBlackCastleKingSide = false; // Black King-side rook
                if (startRow === 0 && startCol === 0) canBlackCastleQueenSide = false; // Black Queen-side rook
            }
        }

        // Fifty-move rule update
        if (isPawnMove || isCapture || captureForEnPassant) {
            fiftyMoveRuleCounter = 0;
        } else {
            fiftyMoveRuleCounter++;
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
            addBoardStateToHistory(); // Add to history after promotion
            checkGameEnd(); // Check for game end after promotion
            if (gameOverOverlay.style.display === 'none') { // Only switch if game not over
                switchPlayer();
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
    const currentPlayerTurn = currentPlayer; // Store current player before potential switch
    const opponentPlayer = currentPlayerTurn === 'white' ? 'black' : 'white';

    const currentStateData = {
        enPassantTarget: enPassantTargetSquare,
        canWhiteCastleKing: canWhiteCastleKingSide,
        canWhiteCastleQueen: canWhiteCastleQueenSide,
        canBlackCastleKing: canBlackCastleKingSide,
        canBlackCastleQueen: canBlackCastleQueenSide
    };

    // Get all possible moves for the current player (who just moved) to determine opponent's state
    // We need to check moves for the *next* player to determine if it's checkmate/stalemate.
    // So, we check for the opponent's moves.
    const opponentPossibleMoves = getAllPossibleMoves(board, opponentPlayer, currentStateData);

    // 1. Checkmate / Stalemate for the *opponent*
    if (opponentPossibleMoves.length === 0) {
        if (isKingInCheck(board, opponentPlayer, currentStateData)) {
            // Opponent has no legal moves AND their king is in check -> Checkmate!
            displayGameOver(currentPlayerTurn === 'white' ? 'White' : 'Black', 'skakmat'); // "Skakmat"
        } else {
            // Opponent has no legal moves AND their king is NOT in check -> Stalemate!
            displayGameOver('Seri', 'skak buntu'); // "Stalemate"
        }
        return; // Game over, no need to check other conditions
    }

    // 2. Fifty-move rule
    if (fiftyMoveRuleCounter >= 100) { // 50 moves for each player = 100 half-moves
        displayGameOver('Seri', 'aturan 50 langkah');
        return;
    }

    // 3. Threefold Repetition
    if (checkThreefoldRepetition()) {
        displayGameOver('Seri', 'tiga kali posisi sama');
        return;
    }

    // 4. Insufficient Material
    if (checkInsufficientMaterial()) {
        displayGameOver('Seri', 'kekurangan bidak untuk menang');
        return;
    }
}

// Function to encapsulate all relevant game state for history
function getCurrentGameStateString() {
    return JSON.stringify({
        board: board,
        enPassant: enPassantTargetSquare,
        whiteCastleK: canWhiteCastleKingSide,
        whiteCastleQ: canWhiteCastleQueenSide,
        blackCastleK: canBlackCastleKingSide,
        blackCastleQ: canBlackCastleQueenSide
    });
}

function checkThreefoldRepetition() {
    const currentBoardString = getCurrentGameStateString();
    let count = 0;
    for (let i = 0; i < history.length; i++) {
        // history stores full board states.
        // For a proper threefold repetition, you need to include castling rights and en passant target.
        // If history only stores `board`, it's less accurate.
        if (JSON.stringify(history[i]) === currentBoardString) { // Compare stringified versions of the whole state
            count++;
        }
    }
    return count >= 3;
}

function addBoardStateToHistory() {
    // Add the full game state to history for accurate threefold repetition
    history.push({
        board: JSON.parse(JSON.stringify(board)),
        enPassant: enPassantTargetSquare ? [...enPassantTargetSquare] : null,
        whiteCastleK: canWhiteCastleKingSide,
        whiteCastleQ: canWhiteCastleQueenSide,
        blackCastleK: canBlackCastleKingSide,
        blackCastleQ: canBlackCastleQueenSide
    });
}

function checkInsufficientMaterial() {
    const allPieces = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] !== '') {
                allPieces.push(board[r][c]);
            }
        }
    }

    // King vs King
    if (allPieces.length === 2) {
        return true;
    }

    // King and Bishop vs King
    // King and Knight vs King
    if (allPieces.length === 3) {
        const hasBishop = allPieces.some(p => p.toLowerCase() === 'b');
        const hasKnight = allPieces.some(p => p.toLowerCase() === 'n');
        if ((hasBishop && !allPieces.some(p => p.toLowerCase() === 'r' || p.toLowerCase() === 'q' || p.toLowerCase() === 'p')) ||
            (hasKnight && !allPieces.some(p => p.toLowerCase() === 'r' || p.toLowerCase() === 'q' || p.toLowerCase() === 'p'))) {
            return true;
        }
    }
    // King and two Knights vs King - generally draw, but can be forced mate.
    // For simplicity, we'll consider K+2N vs K a draw unless there are other pieces.
    if (allPieces.length === 4) {
        const knights = allPieces.filter(p => p.toLowerCase() === 'n');
        if (knights.length === 2 && !allPieces.some(p => p.toLowerCase() === 'r' || p.toLowerCase() === 'q' || p.toLowerCase() === 'p' || p.toLowerCase() === 'b')) {
            // One player has K+2N, the other has K. This is usually a draw unless very specific positions.
            // For a basic check, we can return true.
            return true;
        }
    }

    // King and same-color Bishop vs King and same-color Bishop
    // This is more complex to check, requires checking square color of bishops.
    // For now, we omit this.

    return false;
}

function displayGameOver(winner, reason) {
    let message = '';
    let details = '';
    if (winner === 'Seri') {
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
// Returns an array of { startRow, startCol, endRow, endCol, piece } objects
function getAllPossibleMoves(currentBoard, playerColor, stateData) {
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
                            // isValidMove already checks if move leaves king in check
                            if (isValidMove(r, c, tr, tc, currentBoard, playerColor, stateData)) {
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

// --- Bot Logic (Minimax) ---

function switchPlayer() {
    currentPlayer = (currentPlayer === 'white') ? 'black' : 'white';
    updateTurnIndicator();

    if (currentPlayer === 'black') {
        setTimeout(() => {
            botMove();
        }, 500); // Give a bit more time for rendering after player's move
    }
}


// Applies a move to a given board state and returns the new state data
// This function is crucial for minimax to simulate moves.
function applyMoveToBoard(currentBoard, move, playerColor, originalStateData) {
    let newBoard = JSON.parse(JSON.stringify(currentBoard));
    let newEnPassantTarget = null;
    let newWhiteCastleKing = originalStateData.canWhiteCastleKing;
    let newWhiteCastleQueen = originalStateData.canWhiteCastleQueen;
    let newBlackCastleKing = originalStateData.canBlackCastleKing;
    let newBlackCastleQueen = originalStateData.canBlackCastleQueen;

    const pieceToMove = newBoard[move.startRow][move.startCol];
    const pieceType = pieceToMove.toLowerCase();
    const isWhite = pieceToMove === pieceToMove.toLowerCase();

    // Standard piece movement
    newBoard[move.endRow][move.endCol] = pieceToMove;
    newBoard[move.startRow][move.startCol] = '';

    // Handle Pawn Double Move & En Passant Target
    if (pieceType === 'p' && Math.abs(move.startRow - move.endRow) === 2) {
        newEnPassantTarget = [isWhite ? move.endRow + 1 : move.endRow - 1, move.endCol];
    }

    // Handle En Passant Capture
    // Check if the move IS an en passant capture (target square is empty, pawn moved diagonally)
    if (pieceType === 'p' && Math.abs(move.endCol - move.startCol) === 1 && newBoard[move.endRow][move.endCol] === pieceToMove && currentBoard[move.endRow][move.endCol] === '') {
        const capturedPawnRow = isWhite ? move.endRow + 1 : move.endRow - 1;
        newBoard[capturedPawnRow][move.endCol] = ''; // Remove the captured pawn
    }

    // Handle Castling (King moves 2, Rook moves too)
    if (pieceType === 'k' && Math.abs(move.startCol - move.endCol) === 2) {
        if (move.endCol === 6) { // Kingside
            newBoard[move.startRow][5] = newBoard[move.startRow][7]; // Move rook
            newBoard[move.startRow][7] = ''; // Clear old rook position
        } else if (move.endCol === 2) { // Queenside
            newBoard[move.startRow][3] = newBoard[move.startRow][0]; // Move rook
            newBoard[move.startRow][0] = ''; // Clear old rook position
        }
    }

    // Update Castling Rights
    if (pieceType === 'k') {
        if (isWhite) {
            newWhiteCastleKing = false;
            newWhiteCastleQueen = false;
        } else {
            newBlackCastleKing = false;
            newBlackCastleQueen = false;
        }
    } else if (pieceType === 'r') {
        if (isWhite) {
            if (move.startRow === 7 && move.startCol === 7) newWhiteCastleKing = false;
            if (move.startRow === 7 && move.startCol === 0) newWhiteCastleQueen = false;
        } else {
            if (move.startRow === 0 && move.startCol === 7) newBlackCastleKing = false;
            if (move.startRow === 0 && move.startCol === 0) newBlackCastleQueen = false;
        }
    }
    // Also, if a rook is captured, corresponding castling right is lost
    if (currentBoard[move.endRow][move.endCol] === 'R' && move.endRow === 0) { // Black rook captured
        if (move.endCol === 7) newBlackCastleKing = false;
        if (move.endCol === 0) newBlackCastleQueen = false;
    } else if (currentBoard[move.endRow][move.endCol] === 'r' && move.endRow === 7) { // White rook captured
        if (move.endCol === 7) newWhiteCastleKing = false;
        if (move.endCol === 0) newWhiteCastleQueen = false;
    }


    // Handle Pawn Promotion (always to Queen for bot for simplicity)
    if (pieceType === 'p' && (move.endRow === 0 || move.endRow === 7)) {
        newBoard[move.endRow][move.endCol] = isWhite ? 'q' : 'Q';
    }

    return {
        board: newBoard,
        enPassantTarget: newEnPassantTarget,
        canWhiteCastleKing: newWhiteCastleKing,
        canWhiteCastleQueen: newWhiteCastleQueen,
        canBlackCastleKing: newBlackCastleKing,
        canBlackCastleQueen: newBlackCastleQueen
    };
}


// Evaluation Function: Assigns a numerical score to a given board state
// Positive score favors White, negative favors Black.
function evaluateBoard(currentBoard) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = currentBoard[r][c];
            if (piece) {
                score += pieceValues[piece] || 0; // Add piece value
            }
        }
    }
    // Add more sophisticated evaluation terms here:
    // - Pawn structure (isolated, doubled pawns)
    // - Piece mobility (number of legal moves a piece has)
    // - King safety (number of attacked squares around the king)
    // - Central control
    // - Development (knights and bishops out)
    return score;
}

// Minimax algorithm with alpha-beta pruning (simplified for clarity)
// currentBoard: The board state to evaluate
// depth: Current depth in the search tree
// maximizingPlayer: true if it's the maximizing player's turn (Black Bot), false if minimizing player's turn (White Player)
// alpha: Best score found so far for the maximizing player
// beta: Best score found so far for the minimizing player
// stateData: current enPassantTarget, castling rights
function minimax(currentBoard, depth, maximizingPlayer, alpha, beta, stateData) {
    const playerColor = maximizingPlayer ? 'black' : 'white';

    // Base case: if depth is 0 or game is over
    if (depth === 0) {
        return evaluateBoard(currentBoard); // Evaluate the current board state
    }

    const possibleMoves = getAllPossibleMoves(currentBoard, playerColor, stateData);

    // If no moves, check for checkmate or stalemate
    if (possibleMoves.length === 0) {
        if (isKingInCheck(currentBoard, playerColor, stateData)) {
            return maximizingPlayer ? -Infinity : Infinity; // Checkmate for maximizing player (Bot loses), or minimizing player (Bot wins)
        } else {
            return 0; // Stalemate
        }
    }

    if (maximizingPlayer) { // Bot's turn (Black), tries to maximize its score (minimize White's score)
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            const newState = applyMoveToBoard(currentBoard, move, playerColor, stateData);
            // Recursive call for the opponent's turn (minimizing player)
            const evaluation = minimax(newState.board, depth - 1, false, alpha, beta, newState);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation); // Alpha-beta pruning
            if (beta <= alpha) {
                break; // Beta cut-off
            }
        }
        return maxEval;
    } else { // Player's turn (White), tries to minimize bot's score (maximize its own score)
        let minEval = Infinity;
        for (const move of possibleMoves) {
            const newState = applyMoveToBoard(currentBoard, move, playerColor, stateData);
            // Recursive call for the bot's turn (maximizing player)
            const evaluation = minimax(newState.board, depth - 1, true, alpha, beta, newState);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation); // Alpha-beta pruning
            if (beta <= alpha) {
                break; // Alpha cut-off
            }
        }
        return minEval;
    }
}


function botMove() {
    console.log("Bot's turn (Minimax)...");
    const currentGameStateData = {
        enPassantTarget: enPassantTargetSquare,
        canWhiteCastleKing: canWhiteCastleKingSide,
        canWhiteCastleQueen: canWhiteCastleQueenSide,
        canBlackCastleKing: canBlackCastleKingSide,
        canBlackCastleQueen: canBlackCastleQueenSide
    };

    const possibleMoves = getAllPossibleMoves(board, 'black', currentGameStateData);

    if (possibleMoves.length === 0) {
        checkGameEnd(); // Bot has no legal moves, check if it's checkmate or stalemate
        return;
    }

    let bestMove = null;
    let bestScore = -Infinity; // Bot (Black) wants to maximize its (negative from White's perspective) score

    // Iterate through all possible moves to find the best one using minimax
    for (const move of possibleMoves) {
        const newState = applyMoveToBoard(board, move, 'black', currentGameStateData);
        // Call minimax for the resulting state, assuming it's the *player's* turn next (minimizing player)
        const score = minimax(newState.board, DEPTH_LIMIT - 1, false, -Infinity, Infinity, newState);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    // Execute the chosen move
    if (bestMove) {
        movePiece(bestMove.startRow, bestMove.startCol, bestMove.endRow, bestMove.endCol, (newBoard) => {
            board = newBoard; // Update main board state

            // Bot's pawn promotion is handled inside applyMoveToBoard (always to Queen for simplicity)
            // But visually render it here.
            renderBoard();

            addBoardStateToHistory(); // Add to history after bot's move (and potential promotion)
            checkGameEnd();
            if (gameOverOverlay.style.display === 'none') {
                switchPlayer();
            }
        });
    } else {
        // Fallback if no best move found (should not happen if possibleMoves is not empty)
        console.error("Bot could not find a move despite legal moves being available.");
        checkGameEnd();
    }
}


// Initialize the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeBoard);
