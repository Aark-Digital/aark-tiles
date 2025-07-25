class AarkTilesGame extends BaseGame {
  getGameName() {
    return "aarkTiles";
  }

  getDisplayName() {
    return "Aark-tile";
  }

  getRequiredParams() {
    return ["version", "rows", "seed", "hash"];
  }

  getOptionalParams() {
    return ["selectedTiles"];
  }

  // Parse selected tiles from URL parameter
  getSelectedTiles() {
    const selectedTilesParam = getParam("selectedTiles");
    if (!selectedTilesParam) return [];

    try {
      // Decode URL-encoded string and split by comma
      const decoded = decodeURIComponent(selectedTilesParam);
      return decoded.split(",").map((s) => parseInt(s.trim(), 10));
    } catch {
      return [];
    }
  }

  // Deterministically generates a bomb tile index for a row
  async getBombTileIndex(seed, rowIndex, totalTiles) {
    const hashSource = `${seed}-row${rowIndex}`;
    const hash = await sha256Hex(hashSource);
    const numericHash = parseInt(hash.slice(0, 8), 16);
    return numericHash % totalTiles;
  }

  // Calculates multipliers for each row
  calculateRowMultipliers(tileCounts) {
    const multipliers = [];
    let currentMultiplier = 1;
    const HOUSE_EDGE = 0.05;
    for (let i = 0; i < tileCounts.length; i++) {
      const tiles = tileCounts[i];
      const baseMultiplier = 1 / (1 - 1 / tiles);
      currentMultiplier *= baseMultiplier;
      const multiplierWithEdge = currentMultiplier * (1 - HOUSE_EDGE);
      multipliers.push(multiplierWithEdge);
    }
    return multipliers;
  }

  // Reconstruct rows from tile counts and seed
  async reconstructRows(tileCounts, seed) {
    const multipliers = this.calculateRowMultipliers(tileCounts);
    const rows = [];
    for (let i = 0; i < tileCounts.length; i++) {
      const tiles = tileCounts[i];
      const multiplier = multipliers[i];
      const bombTileIndex = await this.getBombTileIndex(seed, i, tiles);
      rows.push({ tiles, bombTileIndex, multiplier });
    }
    return rows;
  }

  // Parse game data from URL parameters
  async parseGameData() {
    const version = getParam("version") || "v1";
    const rowsInput = getParam("rows") || document.getElementById("rows").value;
    const seed = getParam("seed") || document.getElementById("seed").value;
    const expectedHash = getParam("hash") || document.getElementById("hash").value;



    if (!rowsInput || !seed || !expectedHash) {
      throw new Error("Missing required parameters");
    }

    // Parse comma-separated tile counts
    let tileCounts;
    try {
      tileCounts = rowsInput.split(",").map((s) => parseInt(s.trim(), 10));
      if (tileCounts.some(isNaN)) throw new Error();
    } catch {
      throw new Error("Invalid tile counts (must be comma-separated numbers)");
    }

    return {
      version,
      tileCounts,
      seed,
      expectedHash: expectedHash.trim().toLowerCase(),
      selectedTiles: this.getSelectedTiles(),
    };
  }

  // Reconstruct game state from parsed data
  async reconstructGameState(gameData) {
    const rows = await this.reconstructRows(gameData.tileCounts, gameData.seed);
    return {
      version: gameData.version,
      rows,
      seed: gameData.seed,
      selectedTiles: gameData.selectedTiles,
    };
  }

  // Generate hash from game state
  async generateGameHash(gameState) {
    const gameData = JSON.stringify({
      version: gameState.version,
      rows: gameState.rows,
      seed: gameState.seed,
    });
    return "0x" + (await sha256Hex(gameData));
  }

  // Render the game
  renderGame(gameState, containerId = "visual-view") {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id '${containerId}' not found`);
      return;
    }

    container.innerHTML = "";
    if (!Array.isArray(gameState.rows)) return;

    const { rows, selectedTiles = [] } = gameState;

    rows.forEach((row, i) => {
      // Create row container to hold label and tiles
      const rowContainer = document.createElement("div");
      rowContainer.className = "row-container";

      // Create row label (row numbers start from 1)
      const rowLabel = document.createElement("div");
      rowLabel.className = "row-label";
      rowLabel.textContent = (i + 1).toString();

      // Create row div for tiles
      const rowDiv = document.createElement("div");
      rowDiv.className = "row";

      for (let t = 0; t < row.tiles; t++) {
        const tile = document.createElement("div");
        const isBomb = t === row.bombTileIndex;
        const isSelected = selectedTiles[i] === t;

        // Set tile classes
        let tileClass = "tile";
        if (isBomb) tileClass += " bomb";
        if (isSelected) tileClass += " selected";

        tile.className = tileClass;

        // Set title
        let title = "";
        if (isBomb && isSelected) {
          title = "Selected Bomb Tile";
          // Add skull icon
          tile.innerHTML = "💣";
        } else if (isBomb) {
          title = "Bomb Tile";
        } else if (isSelected) {
          title = "Selected Tile";
        }
        tile.title = title;

        rowDiv.appendChild(tile);
      }

      // Add label and row to container
      rowContainer.appendChild(rowLabel);
      rowContainer.appendChild(rowDiv);
      container.appendChild(rowContainer);
    });
  }


  getFormFieldsHTML() {
    // Always use v1 only (no algorithm version selector)
    const versionField = `<input type="hidden" id="version" name="version" value="v1" />`;

    return `
      ${versionField}
      <label>
        Row Tile Counts
        <textarea id="rows" name="rows" rows="3" required></textarea>
      </label>
      <label>
        Seed
        <input type="text" id="seed" name="seed" required />
      </label>
      <label>
        Hash
        <input type="text" id="hash" name="hash" required />
      </label>
    `;
  }
}

// Toggle between visual and raw JSON views
function setupAarkTilesToggle() {
  const toggleBtn = document.getElementById("toggle-view");
  const visualView = document.getElementById("visual-view");
  const rawView = document.getElementById("rows-config");

  if (!toggleBtn || !visualView || !rawView) return;

  let showingVisual = true;

  toggleBtn.onclick = function () {
    showingVisual = !showingVisual;
    if (showingVisual) {
      visualView.style.display = "";
      rawView.style.display = "none";
      toggleBtn.textContent = "Show Raw JSON";
    } else {
      visualView.style.display = "none";
      rawView.style.display = "";
      toggleBtn.textContent = "Show Visual";
    }
  };
}

// Initialize toggle functionality when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAarkTilesToggle);
} else {
  setupAarkTilesToggle();
}

// Create global instance
const aarkTilesGame = new AarkTilesGame();
