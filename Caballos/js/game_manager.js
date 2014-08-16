function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.Undo_cells = [];
  
  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
 
  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();
  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
	/*	
	var tile = new Tile({x:4, y:1}, 2);	
    this.grid.insertTile(tile);

	tile = new Tile({x:3, y:2}, 4);	
    this.grid.insertTile(tile);	*/
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 4 : 8;
    var tile = new Tile(this.grid.randomAvailableCell(), value);
	
    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
	  tile.Movido = 0;
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;
  var celdas = [];
  var tile;
  var celda;
 
  if (direction == -1) //UNDO
  {		
	this.grid = new Grid(this.size);
	
	for (var x = 0; x < this.Undo_cells.length; x++)
	{
		celda = this.Undo_cells[x];
		this.grid.insertTile(celda.t);
	}
	this.actuate();  
  }
  else
  {  
  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  //Cargo el arreglo de UNDO
  this.Undo_cells = this.grid.TilesCells(); 
  
  var cell, tile;

  var vector2 = self.getVector2(2, direction);
  //var vector2 = self.getVector(0);
    
  var traversals = this.buildTraversals(vector2);  
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();
  
  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {

	  cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile)
	  {	
	  if(tile.Movido == 0)
	  {
		var vector = self.getVector2(tile.value, direction);
        var positions = self.findFarthestPosition(cell, vector, tile);
        var next      = self.grid.cellContent(positions.next);	
		
        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) 
		{//if ((tile.value != 2) || (cell.x != next.x))
		 {
			  var merged = new Tile(positions.next, tile.value * 2);
			  merged.Movido = 1;
			  merged.mergedFrom = [tile, next];

			  self.grid.insertTile(merged);
			  self.grid.removeTile(tile);
			  // Converge the two tiles' positions
			  tile.updatePosition(positions.next);

			  // Update the score
			  self.score += merged.value;

			  // The mighty 2048 tile
			  if (merged.value === 1024) self.won = true;
		  }
        } 
		else 
		{	//if ((tile.value != 2) || (direction == 0) || (direction == 4))
				self.moveTile(tile, positions.farthest);
        }		
        
		if (!self.positionsEqual(cell, tile)) 
          moved = true; // The tile moved from its original cell!        
      }
	  }
    });
  });

		if (moved) 
		{
			this.addRandomTile();   
		};			
		if (!this.movesAvailable()) 
		  this.over = true; // Game over!
		
  };
  this.actuate();
};


// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  //if (vector.x === 1) traversals.x = traversals.x.reverse();
  //if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector, tile) {
  var previous, pieza;
  
	pieza = tile.value;
  

		previous = cell;
		cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
		
		if (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell) && (tile.Movido == 0))
		{		
		previous = cell;
		tile.Movido = 1;
		};

	
  return {
    farthest: previous,//La más lejana a la que puede llegar
    next: cell // El proximo hipotetico despues de "farthest" por si puede mezclar.
  };
};

GameManager.prototype.movesAvailable = function () {
  //return this.grid.cellsAvailable() || this.tileMatchesAvailable() || this.tileSinMovimiento();
  return this.tileConMovimiento();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {

        for (var direction = 0; direction < 8; direction++) {
          var vector = self.getVector2(tile.value, direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }
  return false;
};

GameManager.prototype.tileConMovimiento = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {

        for (var direction = 0; direction < 8; direction++) {
          var vector = self.getVector2(tile.value, direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if ((!other) && (self.grid.withinBounds(cell)))
		  {
             return true; 
          }
        }
      }
    }
  }
  return false;
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
    
};

GameManager.prototype.getVector2 = function (pieza, direction) {
  // Vectors representing tile movement
  var map;
  
  map = {
    0: { x: 1,  y: -2 }, // Up
    1: { x: 2,  y: -1 },  // Right
    2: { x: -1,  y: 2 },  // Down
    3: { x: -2, y: 1 },   // Left
	
	4: { x: -1,  y: -2 }, // Up
    5: { x: 2,  y: 1 },  // Right
    6: { x: 1,  y: 2 },  // Down.
    7: { x: -2, y: -1 }   // Left.
  };  
  
  return map[direction];
};



GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
