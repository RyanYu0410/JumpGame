// Create loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    transition: opacity 0.5s;
`;

// Create loading spinner
const spinner = document.createElement('div');
spinner.style.cssText = `
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
`;

// Create loading text
const loadingText = document.createElement('div');
loadingText.textContent = 'Loading Game...';
loadingText.style.cssText = `
    color: white;
    font-size: 24px;
    font-family: Arial, sans-serif;
`;

// Create progress text
const progressText = document.createElement('div');
progressText.textContent = '0%';
progressText.style.cssText = `
    color: white;
    font-size: 18px;
    font-family: Arial, sans-serif;
    margin-top: 10px;
`;

// Add spinner animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

// Add elements to overlay
loadingOverlay.appendChild(spinner);
loadingOverlay.appendChild(loadingText);
loadingOverlay.appendChild(progressText);
document.body.appendChild(loadingOverlay);

// Track loading progress
let loadedAssets = 0;
const totalAssets = 2; // Adjust based on number of assets (model + textures)

function updateProgress() {
    loadedAssets++;
    const progress = Math.round((loadedAssets / totalAssets) * 100);
    progressText.textContent = `${progress}%`;
    
    if (loadedAssets === totalAssets) {
        // Fade out and remove loading screen
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
        }, 500);
    }
}

// Export function to be called when assets are loaded
window.updateLoadingProgress = updateProgress;
