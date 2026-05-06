main.js
this is the start point.
it creates an engine object and calls engine.start on domcontentloaded

engine.js
start() - raf(animate), (it currently inits enemy objects), (it can also be used to init stuff?)
animate(currentTime) - loop
constructor() - 
creates renderer object, gets scene and cam from renderer.
creates a world object, passes the player collider and world octree to player.
creates an audioManager (ill also be creating particleSystem and animPlayer objects in here)
adds the player controls object to scene.

renderer.js
creates scene, camera, renderer, composer, shader and postprocess passes and applies them
initRenderPasses()
onResize()
render() - pass this function to animate loop

world.js
loads the map gltf/glb to scene, applies worldoctree to model and adds lights

audioManager.js
async load(name, url, volume = 1.0)
play(name, { loop = false, volume = 1.0, rate = 1.0, pan = 0.0 } = {})
setvolume(name, volume)
stop(source)
unlock()

particleSystem.js
constructor(scene, player)
create(name, size) - creates ambient particle system around the player
updateParticles(time) - updates the particles (this currently just works for particles of create function)
spawnImpactParticles(position, normal, particleSize) - creates impact particles at the point given (includes its own update loop)

animPlayer.js
am not sure if i need to have 1 anim player for all the animations or have anima player for each mesh
constructor(model, animation)
play(name, loop = THREE.LoopOnce)
update(deltaTime) - updates the animation timeline


player.js
the most imp class of my game it will be the player
constructor(scene, camera, domElement, worldOctree, keyStates, collider, audioManager)
constructor will be initializing all the class related var
creates a pointerLockControls, cameraEffects, playerPhysics, weaponManger object
initializes heart and breathing related vars (this system needs to be moved into a new class)
it calls the loadBody and bindKeys function

async loadBody() - loads both hands, a heart, sets a proper heirarchy and creates an animPlayer for right hand.
it also loads all the sounds required (this definetly needs to be changed)

bindKeys() - adds event listeners for mouse buttons, wheels and keyboard keys (it stores the keyStates in a list/array as a bool based on if its pressed or not)

update() - calls playerPhysics.update and cameraEffects.update.
animates player hand bobbing.
calls hand_anim.update (animPlayer obj created by right hand)
handles heart rate breathing logic with heart being animated along with handling the audio.


cameraEffects.js
handles cam effects like head bobing recoil shake (more to be added like fov change on sprint and slide, left right strafe tilts)
constructor(camera)
triggerShake(intensity = 0.05)
update(deltaTime, keyStates) - calls updateHeadBob(deltaTime, keyStates) and also handles recoil shake
updateHeadBob(deltaTime, keyStates) - if player is moving camera moves up down (sin wave)


physics.js
handles player physics like collisions, friction, movement etc
constructor(playerCollider, worldOctree, camera, keyStates, camEffects)
inits imp var

update(deltaTime) - calls this.controls(deltaTime)
handles gravity, movement, jumping, player velocity
moves the collider
calls this.playerCollisions()
moves the camera with playerCollider
handles player sliding and its cooldown

playerCollisions() - using the playerCollider capsule and worldOctree it checks if capsule intersects
getForwardVector()
getSideVector()
constrols(deltaTime) - using the keyStates bool list it handles player constrols
startSlide()
endSlide()
getVelocity()
isOnFloor()


weaponManger.js
export const weapons = {
    name: {name, type, damage, range, cooldown, fireRate, recoil, spread, ammo, reloadTime, anim, sounds}
}

constructor(player, scene)
inits weapon_inventory and other vars, and currently also innits particleSystem (we might move this to engine.js and make 1 common particle system for all)
switch_weapons(new_weapon) - if the new_weapon is in weapon_inventory then stops firing, and swaps the current weapon with new_weapon
cycle_weapon(direction) - cycles thru weapon_inventory in the direction of mouse scroll and then calls this.switch_weapons(new_weapon)
add_weapon(weapon_name) - adds the named weapon
canFire() - based on fireRate / cooldown
startFiring() - if it canFire, it loops if weapon is auto and calls this.fire(), stops when called this.stopFiring()
stopFiring()
fire() - if not blocked by cooldown or reload, it shoots, trigers animation(yet to impement), reduces ammo, applies recoil, plays sounds, and animates
reload() - reloads and blocks firing and all till reloading, plays sounds and soon will also play the anim
applyRecoil(amount) - calculates the recoilAngle and calls the cameraEffects.triggerShake(amount)
getRayDirection(spread) - gets the direction in which the ray will be fired affected with the gun's spread
raycastShoot(direction) - raycasts, and spawns particles at impact point, appies muzzle at fingertips, and also deals damage if the object is tagged as enemy
flashMuzzle(offset, direct) - adds muzzle flash png texture to a sprite 