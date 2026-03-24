type StringKeyOf<T> = Extract<keyof T, string>;

type CallbackArgs<T extends Record<string, any>, EventName extends StringKeyOf<T>> = T[EventName] extends any[]
  ? T[EventName]
  : [T[EventName]];

type Callback<T extends Record<string, any>, EventName extends StringKeyOf<T>> = (
  ...args: CallbackArgs<T, EventName>
) => void;

export class EventEmitter<T extends Record<string, any>> {
  private callbacks: Partial<Record<StringKeyOf<T>, Array<(...args: any[]) => void>>> = {};

  on<EventName extends StringKeyOf<T>>(event: EventName, callback: Callback<T, EventName>) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }

    this.callbacks[event]?.push(callback);
    return this;
  }

  off<EventName extends StringKeyOf<T>>(event: EventName, callback?: Callback<T, EventName>) {
    const callbacks = this.callbacks[event];

    if (!callbacks?.length) {
      return this;
    }

    if (!callback) {
      delete this.callbacks[event];
      return this;
    }

    this.callbacks[event] = callbacks.filter((current) => current !== callback);
    return this;
  }

  emit<EventName extends StringKeyOf<T>>(event: EventName, ...args: CallbackArgs<T, EventName>) {
    const callbacks = this.callbacks[event];

    if (!callbacks?.length) {
      return this;
    }

    callbacks.forEach((callback) => callback.apply(this, args));
    return this;
  }

  once<EventName extends StringKeyOf<T>>(event: EventName, callback: Callback<T, EventName>) {
    const onceCallback = (...args: CallbackArgs<T, EventName>) => {
      this.off(event, onceCallback);
      callback.apply(this, args);
    };

    return this.on(event, onceCallback);
  }

  removeAllListeners() {
    this.callbacks = {};
  }
}
