import * as THREE from 'three';


// export default class AnimPlayer {
//     constructor(mesh, animations) {
//         this.mixer = new THREE.AnimationMixer(mesh);
//         this.animations = animations;
//         this.currentAction = null;
//         this.finishedCallback = null;
//     }

//     play(name, onFinish) {
//         const clip = THREE.AnimationClip.findByName(this.animations, name);
//         if (!clip) return;

//         this.finishedCallback = onFinish || null;

//         this.currentAction = this.mixer.clipAction(clip);
//         this.currentAction.reset();
//         this.currentAction.play();

//         this.duration = clip.duration;
//         this.elapsed = 0;
//     }

//     stop() {
//         if (this.currentAction) {
//             this.currentAction.stop();
//         }
//     }

//     update(delta) {
//         this.mixer.update(delta);

//         if (this.currentAction) {
//             this.elapsed += delta;

//             if (this.elapsed >= this.duration && this.finishedCallback) {
//                 const cb = this.finishedCallback;
//                 this.finishedCallback = null;
//                 cb();
//             }
//         }
//     }
// }




///ORIGNAL ONE


export default class AnimPlayer {
    constructor(model, animations) {
        this.mixer = new THREE.AnimationMixer(model);
        this.actions = {};
        this.currentAction = null;

        animations.forEach((clip) => {
            this.actions[clip.name] = this.mixer.clipAction(clip);
            this.actions[clip.name].enabled = true;
        });
    }

    play(name, loop = THREE.LoopOnce) {
        const action = this.actions[name];
        if (!action) {
            console.warn(`No animation named ${name}`);
            return;
        }

        if (this.currentAction === action) return; // Already playing

        action.reset();               // reset to frame 0
        action.setLoop(loop);
        action.clampWhenFinished = (loop === THREE.LoopOnce);

        console.log("Playing ", name);

        if (this.currentAction) {
            // crossfade from current to next action over 0.3s
            this.currentAction.crossFadeTo(action, 0.07, false);
            action.play();            // <== **play the new action explicitly here!**
        } else {
            action.play();
        }

        this.currentAction = action;
    }


    update(deltaTime) {
        this.mixer.update(deltaTime);
    }
}

//  NOTE, TAG, IMP:update the above class with the below one hehehe


// export default class AnimPlayer {
//     constructor(model, animations) {
//         this.mixer = new THREE.AnimationMixer(model);
//         this.actions = {};
//         this.currentAction = null;

//         animations.forEach((clip) => {
//             const action = this.mixer.clipAction(clip);
//             action.enabled = true;
//             this.actions[clip.name] = action;
//         });
//     }

//     play(name, loop = THREE.LoopOnce, blend = false) {
//         const action = this.actions[name];
//         if (!action) {
//             console.warn(`No animation named ${name}`);
//             return;
//         }

//         action.reset();
//         action.setLoop(loop);
//         action.clampWhenFinished = (loop === THREE.LoopOnce);

//         if (blend && this.currentAction && this.currentAction !== action) {
//             this.currentAction.crossFadeTo(action, 0.1, false);
//         } else {
//             if (this.currentAction && this.currentAction !== action) {
//                 this.currentAction.stop();
//             }
//             action.play();
//         }

//         this.currentAction = action;
//     }

//     update(deltaTime) {
//         this.mixer.update(deltaTime);
//     }
// }
