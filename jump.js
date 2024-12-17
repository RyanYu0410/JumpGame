let scene, camera, renderer;
let player, playerMixer, playerAction, platforms = [];
let score = 0;
let jumping = false;
let jumpVelocityY = 0;
let gravity = 0.5;
let jumpPower = 15;
let maxHorizontalDisplacement = 100;
let indicator, mousePressStart = 0;
let charging = false;
let gameEnded = false;
let jumpDirection = new THREE.Vector3();
let targetPlatform;
let landingPredictor; // 落点预测指示器
let powerBar; // 蓄力条
let jumpTrajectory; // 跳跃轨迹线
let playerShadow; // 玩家阴影
let isPreparingJump = false; // Add this to track jump preparation state
let indicatorLayer; // New group for indicators
let modelLoaded = false; // Add flag to track if model is loaded
let platformGlitchMaterial; // Material for platform glitch effect
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function init() {
    console.log("Initializing game scene...");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Create indicator layer that will stay above platforms
    indicatorLayer = new THREE.Group();
    scene.add(indicatorLayer);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Initialize glitch material
    platformGlitchMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0xffffff) },
            glitchIntensity: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            uniform float time;
            uniform float glitchIntensity;
            
            void main() {
                vUv = uv;
                vec3 pos = position;
                float glitch = sin(time * 10.0 + position.y * 20.0) * 0.1 * glitchIntensity;
                pos.x += glitch;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec3 color;
            uniform float time;
            uniform float glitchIntensity;
            
            void main() {
                vec3 finalColor = color;
                float glitch = sin(time * 15.0 + vUv.y * 50.0) * glitchIntensity;
                finalColor += vec3(glitch * 0.1);
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    });

    platforms = [];
    const initialPlatform = createPlatform(0, 0, 8);
    platforms.push(initialPlatform);
    scene.add(initialPlatform);
    
    generateNewPlatform();

    // Create a simple box as the player instead of loading model
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(geometry, material);
    player.position.set(0, 2, 0); // Position above initial platform
    player.castShadow = true;
    scene.add(player);
    modelLoaded = true;

    // 创建玩家阴影
    playerShadow = createPlayerShadow();
    indicatorLayer.add(playerShadow);

    // 创建落点预测指示器
    landingPredictor = createLandingPredictor();
    indicatorLayer.add(landingPredictor);

    // 创建蓄力条
    powerBar = createPowerBar();
    indicatorLayer.add(powerBar);

    // 创建跳跃轨迹线
    jumpTrajectory = createJumpTrajectory();
    indicatorLayer.add(jumpTrajectory);

    // Add touch event listeners for mobile devices
    if (isMobile) {
        renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
        renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
        renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    } else {
        renderer.domElement.addEventListener('mousedown', onMouseDown);
        renderer.domElement.addEventListener('mouseup', onMouseUp);
    }

    animate();
}

function createPlatform(x, y, size) {
    console.log(`Creating platform at (${x}, ${y}) with size ${size}`);
    const geometry = new THREE.BoxGeometry(size, 2, size);
    const material = platformGlitchMaterial.clone();
    material.uniforms.color.value = new THREE.Color(Math.random() * 0xffffff);
    material.uniforms.glitchIntensity.value = 0;
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, 0);
    platform.receiveShadow = true;
    return platform;
}

function createPlayerShadow() {
    console.log("Creating player shadow...");
    const geometry = new THREE.CircleGeometry(0.5, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3
    });
    const shadow = new THREE.Mesh(geometry, material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    return shadow;
}

function createLandingPredictor() {
    console.log("Creating landing predictor...");
    const geometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const predictor = new THREE.Mesh(geometry, material);
    predictor.rotation.x = -Math.PI / 2; // 使圆环平躺
    predictor.visible = false;
    predictor.renderOrder = 1;
    return predictor;
}

function createPowerBar() {
    console.log("Creating power bar...");
    const geometry = new THREE.BoxGeometry(0.2, 5, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const bar = new THREE.Mesh(geometry, material);
    bar.visible = false;
    bar.renderOrder = 1;
    return bar;
}

function createJumpTrajectory() {
    console.log("Creating jump trajectory...");
    const points = [];
    for(let i = 0; i < 50; i++) {
        points.push(new THREE.Vector3(0, 0, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    const trajectory = new THREE.Line(geometry, material);
    trajectory.renderOrder = 1;
    return trajectory;
}

function generateNewPlatform() {
    console.log("Generating new platform...");
    const lastPlatform = platforms[platforms.length - 1];
    const minDistance = 5;
    const maxDistance = 15;
    let validPosition = false;
    let newPlatform;
    
    while (!validPosition) {
        const distance = Math.random() * (maxDistance - minDistance) + minDistance;
        const angle = Math.random() * Math.PI * 2; // Random angle for full 360 degree placement
        const x = lastPlatform.position.x + Math.cos(angle) * distance;
        const z = lastPlatform.position.z + Math.sin(angle) * distance;
        const y = Math.random() * 4 - 2; // Random height variation between -2 and 2
        const size = Math.random() * 3 + 5;
        
        newPlatform = createPlatform(x, y, size);
        
        // Check for intersection with existing platforms
        validPosition = true;
        for (let platform of platforms) {
            const dx = newPlatform.position.x - platform.position.x;
            const dy = newPlatform.position.y - platform.position.y;
            const dz = newPlatform.position.z - platform.position.z;
            const minDistance = (newPlatform.geometry.parameters.width + platform.geometry.parameters.width) / 2;
            
            if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minDistance) {
                validPosition = false;
                break;
            }
        }
    }
    
    // Remove old platforms to prevent memory issues
    if (platforms.length > 5) {
        scene.remove(platforms[0]);
        platforms.shift();
    }
    
    // Animate platform appearance with glitch effect
    newPlatform.material.uniforms.glitchIntensity.value = 1.0;
    scene.add(newPlatform);
    platforms.push(newPlatform);
    targetPlatform = newPlatform;

    // Gradually reduce glitch effect over a longer duration
    const glitchDuration = 6.0; // Increased from 1.0 to 3.0 seconds
    const startTime = Date.now();
    
    function updateGlitch() {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / glitchDuration, 1.0);
        
        // Use easing function for smoother transition
        const eased = 1 - Math.pow(1 - progress, 3); // Cubic easing
        newPlatform.material.uniforms.glitchIntensity.value = 1.0 - eased;
        
        if (progress < 1.0) {
            requestAnimationFrame(updateGlitch);
        }
    }
    
    updateGlitch();
    console.log("New platform generated at:", newPlatform.position);
}

function updateTrajectoryPredictor(power) {
    if (!charging || !targetPlatform || isPreparingJump || !player) return;

    const direction = new THREE.Vector3()
        .subVectors(targetPlatform.position, player.position)
        .normalize();
    
    const points = [];
    const simulatedPos = new THREE.Vector3().copy(player.position);
    let simulatedVelocityY = power;
    const simulatedDirection = direction.clone().multiplyScalar(power * 0.1);

    for(let i = 0; i < 50; i++) {
        points.push(new THREE.Vector3().copy(simulatedPos));
        simulatedPos.x += simulatedDirection.x;
        simulatedPos.z += simulatedDirection.z;
        simulatedPos.y += simulatedVelocityY * 0.1;
        simulatedVelocityY -= gravity;
    }

    jumpTrajectory.geometry.setFromPoints(points);
    jumpTrajectory.visible = true;

    // 更新落点预测器位置
    const landingPoint = calculateLandingPoint(power, direction);
    landingPredictor.position.copy(landingPoint);
    landingPredictor.position.y += 0.1; // Lift slightly above platform
    landingPredictor.visible = true;
    console.log("Trajectory predictor updated with power:", power);
}

function calculateLandingPoint(power, direction) {
    const simulatedPos = new THREE.Vector3().copy(player.position);
    let simulatedVelocityY = power;
    const simulatedDirection = direction.clone().multiplyScalar(power * 0.1);

    while(simulatedPos.y > targetPlatform.position.y) {
        simulatedPos.x += simulatedDirection.x;
        simulatedPos.z += simulatedDirection.z;
        simulatedPos.y += simulatedVelocityY * 0.1;
        simulatedVelocityY -= gravity;
    }

    simulatedPos.y = targetPlatform.position.y + 0.1; // Set to platform height plus small offset
    console.log("Calculated landing point:", simulatedPos);
    return simulatedPos;
}

function onMouseDown(event) {
    if (!jumping && modelLoaded) {
        mousePressStart = Date.now();
        charging = true;
        powerBar.visible = true;
        jumpTrajectory.visible = true;
        console.log("Mouse down, charging started.");
    }
}

function onMouseUp(event) {
    if (charging && player) {
        const power = Math.min((Date.now() - mousePressStart) / 1000 * jumpPower, jumpPower * 2);
        powerBar.visible = false;
        jumpTrajectory.visible = false;
        landingPredictor.visible = false;
        isPreparingJump = true;
        console.log("Mouse up, jump initiated with power:", power);
        setTimeout(() => {
            isPreparingJump = false;
            jump(power);
        }, 400); // 0.4s delay before jumping
    }
}

function onTouchStart(event) {
    event.preventDefault();
    if (!jumping && modelLoaded) {
        mousePressStart = Date.now();
        charging = true;
        powerBar.visible = true;
        jumpTrajectory.visible = true;
        console.log("Touch start, charging started.");
    }
}

function onTouchMove(event) {
    event.preventDefault();
    // Add touch move handling if needed
}

function onTouchEnd(event) {
    event.preventDefault();
    if (charging && player) {
        const power = Math.min((Date.now() - mousePressStart) / 1000 * jumpPower, jumpPower * 2);
        powerBar.visible = false;
        jumpTrajectory.visible = false;
        landingPredictor.visible = false;
        isPreparingJump = true;
        console.log("Touch end, jump initiated with power:", power);
        setTimeout(() => {
            isPreparingJump = false;
            jump(power);
        }, 400); // 0.4s delay before jumping
    }
}

function jump(power) {
    if (!jumping && !gameEnded && player && targetPlatform) {
        jumping = true;
        charging = false;

        const direction = new THREE.Vector3()
            .subVectors(targetPlatform.position, player.position)
            .normalize();
        
        jumpVelocityY = power;
        jumpDirection.copy(direction).multiplyScalar(power);
        console.log("Jumping with power:", power, "and direction:", direction);
    }
}

function checkLanding() {
    if (!player) return;

    const playerPos = player.position;
    
    for (let platform of platforms) {
        const platformPos = platform.position;
        const size = platform.geometry.parameters.width;
        
        if (playerPos.y <= platformPos.y + 2 &&
            Math.abs(playerPos.x - platformPos.x) < size/2 &&
            Math.abs(playerPos.z - platformPos.z) < size/2) {
            
            player.position.y = platformPos.y + 2;
            jumping = false;
            score++;
            document.getElementById('score').textContent = `Score: ${score}`;
            generateNewPlatform();
            console.log("Landed on platform, score:", score);
            return true;
        }
    }
    
    // Check if player has fallen off
    if (playerPos.y < -10) {
        gameEnded = true;
        console.log("Game over, player fell off. Final score:", score);
        gameOver(); // Call gameOver function from game.html
        return false;
    }
    
    // Check if player is too far from any platform horizontally
    let tooFar = true;
    for (let platform of platforms) {
        const dx = playerPos.x - platform.position.x;
        const dz = playerPos.z - platform.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < 30) { // Adjust this value based on your game's scale
            tooFar = false;
            break;
        }
    }
    
    if (tooFar) {
        gameEnded = true;
        console.log("Game over, player jumped too far. Final score:", score);
        gameOver(); // Call gameOver function from game.html
        return false;
    }
    
    return false;
}

function animate() {
    requestAnimationFrame(animate);

    // Update platform glitch effects
    const time = Date.now() * 0.001;
    platforms.forEach(platform => {
        if (platform.material.uniforms) {
            platform.material.uniforms.time.value = time;
        }
    });

    if (jumping && player) {
        player.position.x += jumpDirection.x * 0.1;
        player.position.z += jumpDirection.z * 0.1;
        player.position.y += jumpVelocityY * 0.1;
        jumpVelocityY -= gravity;

        checkLanding();
    }

    if (charging && player && !isPreparingJump) {
        const power = Math.min((Date.now() - mousePressStart) / 1000 * jumpPower, jumpPower * 2);
        
        // 更新蓄力条
        powerBar.scale.y = power / jumpPower;
        powerBar.position.copy(player.position).add(new THREE.Vector3(2, power, 0));
        
        // 更新预测轨迹和落点
        updateTrajectoryPredictor(power);
    }

    // 更新玩家阴影
    if (player) {
        const raycaster = new THREE.Raycaster(player.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObjects(platforms);
        if (intersects.length > 0) {
            playerShadow.position.copy(intersects[0].point);
            playerShadow.position.y += 0.1;
            playerShadow.visible = true;
            const distance = intersects[0].distance;
            playerShadow.scale.set(1 + distance * 0.1, 1 + distance * 0.1, 1);
            playerShadow.material.opacity = Math.max(0.3 - distance * 0.03, 0);
        } else {
            playerShadow.visible = false;
        }
    }

    // 相机跟随
    if (player) {
        const cameraTarget = new THREE.Vector3(
            player.position.x + 15,
            player.position.y + 15,
            player.position.z + 15
        );
        camera.position.lerp(cameraTarget, 0.1);
        camera.lookAt(player.position);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    console.log("Window resized, updated camera and renderer.");
});

init();