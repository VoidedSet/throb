export class StateManager {
    constructor(engine) {
        this.engine = engine;
        this.currentState = null;
    }

    setState(StateClass) {
        if (this.currentState instanceof StateClass) return;

        if (this.currentState) {
            this.currentState.exit();
        }

        this.currentState = new StateClass(this.engine);
        this.currentState.enter();
    }

    update(deltaTime) {
        if (this.currentState) this.currentState.update(deltaTime);
    }
}
