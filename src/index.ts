import "./index.html";
import "./index.css";
import "./img/circle.svg";
import "./img/cross.svg";

import * as Vector from "victor";
interface Vector { x: number; y: number; }
Vector.prototype.absVector = function () {
	const [x, y] = [this.x, this.y].map(Math.abs);
	return new Vector(x, y);
};

Vector.prototype.equals = function (anotherVector) {
	const [x, y] = [anotherVector.x, anotherVector.y];
	return this.x === x && this.y === y;
};
import * as aqual from "almost-equal";

import * as localforage from "localforage";
import { Learner, Generator } from "./ai";
import { doc, square } from "@tensorflow/tfjs";

export enum Player {
	O = "o",
	X = "x"
}

export class Board {
	public moves: Move[];
	public size: number;
	public winner: Player;
	public winningMoves: Vector[];
	public currentPlayer: Player;
	public name: string;
	public onWin: () => void;
	public onMoveAdded: (m: Move) => void;
	constructor(size = 16, startingPlayer = Player.X) {
		this.moves = [];
		this.size = size;
		this.winner = undefined;
		this.currentPlayer = startingPlayer;

		// Win callback
		this.onWin = () => false;
		this.onMoveAdded = () => false;
	}

	public toJSON() {
		return JSON.stringify({
			moves: this.moves,
			winner: this.winner
		});
	}

	public toObject() {
		return {
			moves: this.moves,
			winner: this.winner
		};
	}

	public addMove(m) {
		// Update the current player
		const cp = this.currentPlayer;
		this.currentPlayer = this.currentPlayer === Player.X ? Player.O : Player.X;

		// Don't mark already occupied col
		if (
			this.moves.some((move) => move.x === m.x && move.y === m.y)
		) {
			return;
		} else if (this.winner) {
			return;
		}

		// Add move to collection
		this.moves.push(m);

		// Determine win
		this.checkWin(m);

		// Log the move
		console.log(`Player ${this.currentPlayer} clicked ${m.x}:${m.y}`);

		// Fire event
		this.onMoveAdded(m);
	}

	public checkWin(lastMove?) {
		if (!lastMove) {
			this.checkWinRecursive();
			return;
		}
		const { x, y, p } = lastMove;

		const ownMoves = this.moves
			.filter((move) => move.p === p);

		if (ownMoves.length < 5) {
			return;
		}

		// How many in adjacent are needed to win?
		const n = 5;
		const distance = n - 1;

		const thisVector: Vector = new Vector(x, y);

		// Convert own moves to vectors
		const ownVectors = ownMoves
			.map((move) => {
				return new Vector(move.x, move.y);
			});

		// Find points in distance n or sqrt(2)n to point
		const vectorsOnSquare: Vector[] = ownVectors
			.filter((vector) => {
				return (vector.distanceSq(thisVector) === Math.pow(distance, 2)
					|| vector.distanceSq(thisVector) === 2 * Math.pow(distance, 2));
			});

		const vectorsInSquare: Vector[] = ownVectors
			.filter((vector) => {
				return (vector.distanceSq(thisVector) < Math.pow(distance, 2)
					|| vector.distanceSq(thisVector) < 2 * Math.pow(distance, 2));
			})
			.filter((vector) => {
				return !(vector.x === thisVector.x && vector.y === thisVector.y);
			})
			.filter((vector) => {
				return !vectorsOnSquare.includes(vector);
			});

		let winningMoves;
		const hasWon = vectorsOnSquare
			.some((squareVector) => {
				const vectorsBetween = vectorsInSquare
					.filter((vector) => {
						return isBetween(thisVector, squareVector, vector);
					});
				if (vectorsBetween.length === 3) {
					winningMoves = [...vectorsBetween, squareVector, thisVector];
					return true;
				}
			});

		if (hasWon) {
			this.winner = p;
			this.winningMoves = winningMoves;
			return true;
		}

		function isBetween(pointA, pointB, pointBetween) {
			const AdivB = pointA.clone().divide(pointB).normalize();

			const AtoB = pointA.clone().distance(pointB);
			const AtoX = pointA.clone().distance(pointBetween);
			const BtoX = pointB.clone().distance(pointBetween);
			return aqual(AtoB, AtoX + BtoX);
		}
	}

	public render() {
		return this.renderBoard().concat(this.renderStats());
	}

	public renderStats() {
		return `
        <div id="stats">
            <div class="cp">
                <b>Current player:</b>
                <span class="cp ${this.currentPlayer}">${this.currentPlayer}</span>
			</div>
            <b>Moves:</b>
        	<table class="moves">
            <thead>
                <th>#</th>
                <th>Player</th>

                <th>Coords</th>
			</thead>
			<tbody>
           ${this.moves.map((move, index) => {
				return `
			   <tr class="move ${this.isWinMove(move) ? "winmove" : ""}">
				   <td class="number">${index}</td>
				   <td class="player ${move.p}">${move.p}</td>
				   <td class="coords">[${move.x}, ${move.y}]</td>
			   </tr>
		   `;
			})}
			</tbody>
        </table>
		</div>
    `;
	}

	public renderBoard() {
		const rows = new Array(this.size).fill(1).map((row, y) => {
			const cols = new Array(this.size).fill(1).map((col, x) => {
				const move = this
					.moves
					.find((m) => {
						return m.x === x && m.y === y;
					});
				const isWinningMove = move && this.isWinMove(move);
				return `<td class="col ${move ? move.p : ""} ${isWinningMove ? "wincol" : ""}" x="${x}" y="${y}"></td>`;
			});
			return `
			<tr class="row">
				<td class="guide">${y}</td>
				${cols.join("")}
			</tr>`;
		});

		return `
		<table id="board">
			<thead>
			<tr>
			<th></th>
				${
			Array.apply(null, { length: this.size }).map(Number.call, Number).map((col) => {
				return `<th>${col}</th>`;
			})}
		 	 </tr>
			</thead>
			${ rows.join("")}
		</table>`;
	}

	private checkWinRecursive() {
		for (const move of this.moves) {
			if (this.checkWin(move)) {
				break;
			}
		}
	}

	private isWinMove(move: Move) {
		return this.winningMoves && this.winningMoves.some((vector) => {
			return vector.x === move.x && vector.y === move.y;
		});
	}
}

export class Move {
	public x: number;
	public y: number;
	public p: Player;
	constructor(x: string, y: string, p = Player.X) {
		this.x = parseInt(x, 10);
		this.y = parseInt(y, 10);
		this.p = p;
	}
}

class App {
	public onBoardLoaded: (board: Board) => void;
	public onBoardSaved: (board: Board) => void;
	public onRenderComplete: () => void;
	public board: Board;
	private target: any;
	private key: string;
	constructor(target, board) {
		this.target = target;
		this.board = board;

		this.key = "savedBoards";

		// First render
		this.render();

		// Auto save on game end
		this.board.onWin = async () => {
			await this.saveCurrentBoard(new Date().toJSON());
			await this.render();
		};

		this.board.onMoveAdded = () => {
			this.render();
		};

		// Init events
		this.onRenderComplete = () => false;
		this.onBoardLoaded = () => this.render();
		this.onBoardSaved = () => false;
	}

	public async render() {
		let html = "";

		const savedBoards = await this.getSavedBoards() || [];
		html += `
		<div class="boardSelector">
		<select name="boards" id="boards">
		${savedBoards.map((board, index) => {
				return `<option id="${index}">${board.name}</option>`;
			})}
		</select>
		<input type="button" value="Load" id="loadButton">
		<input type="button" value="Delete" id="deleteButton">
		</div>
		`;

		html += `
		<div class="boardSaver">
		<input type="text" name="boardSaver" id="saveName">
		<input type="button" value="Save" id="saveButton">
		</div>
		`;

		html += `
		<div class="console">
			<input type="text" name="console" id="console" autocomplete="on">
		</div>
		`;

		html += this.board.render();

		document.querySelector(this.target).innerHTML = html;
		this.registerEventHandlers();
		this.onRenderComplete();
	}

	public registerEventHandlers() {
		document.querySelectorAll("td.col").forEach((col) => {
			col.addEventListener("click", (event) => {
				onClickCol(event.target, this);
			});
		});

		function onClickCol(col, appInstance) {
			const [x, y] = [col.getAttribute("x"), col.getAttribute("y")];
			appInstance.board.addMove(new Move(x, y, appInstance.board.currentPlayer));
			appInstance.render();
		}

		// Saving
		document
			.querySelector("#saveButton")
			.addEventListener("click", async () => {
				await this.saveCurrentBoard(
					(document
						.querySelector("#saveName") as HTMLSelectElement)
						.value
				);
				await this.render();
				this.onBoardSaved(this.board);
			});

		// Loading
		document
			.querySelector("#loadButton")
			.addEventListener("click", async () => {
				const value = (document
					.querySelector("select#boards") as HTMLSelectElement)
					.value;

				const boards = await this.getSavedBoards();
				const boardToLoad = boards.find((b) => {
					return b.name === value;
				});

				await this.loadBoard(boardToLoad);
				this.board.checkWin();
				this.onBoardLoaded(this.board);
			});

		// Deleting
		document
			.querySelector("#deleteButton")
			.addEventListener("click", async () => {
				const value = (document
					.querySelector("select#boards") as HTMLSelectElement)
					.value;

				this.deleteBoard(value);
				this.render();
			});

		// Console
		document
			.querySelector("#console")
			.addEventListener("keyup", (e) => {
				// Enter key was pressed
				if (e.keyCode === 13) {
					const command = (e.target as HTMLInputElement).value;
					// tslint:disable-next-line:no-eval
					eval(command);
				}
			});
	}

	public async loadBoard(board) {
		this.board = Object.assign(new Board(), {
			...board,
			moves: [
				...board.moves.map((move) => {
					return new Move(move.x, move.y, move.p);
				})
			]
		});
		await this.render();
	}

	public async saveCurrentBoard(name) {
		const savedBoards = await localforage.getItem(this.key) || [];
		const boardToSave = Object.assign(this.board.toObject(), { name });
		await localforage.setItem(this.key, [...savedBoards as Board[], boardToSave]);
	}

	public async deleteBoard(name) {
		const savedBoards = (await localforage.getItem(this.key) as Board[]) || [];
		const updatedBoards = savedBoards.filter((board) => board.name !== name);
		await localforage.setItem(this.key, updatedBoards);
		await this.render();
	}

	public async getSavedBoards() {
		return (await localforage.getItem(this.key) as Board[]);
	}
}
// TODO: normalize nomenclature
// TODO: extract selectors from HTML Templates to Selectors property

class SelfPlayer {
	private app: App;
	private ai: Learner;
	constructor(app: App) {
		this.app = app;
		this.ai = new Learner();
	}

	public play() {
		const nextMove = this.ai.nextMove(this.app.board);
		this.app.board.addMove(nextMove);
	}

	public playOnRenderComplete() {
		this.app.onRenderComplete = () => {
			if (!this.app.board.winner || this.app.board.moves.length === Math.pow(this.app.board.size, 2) - 1) {
				this.play();
			}
		};
	}
}

const appI = new App("#app", new Board(16));
const selfPlayer = new SelfPlayer(appI);