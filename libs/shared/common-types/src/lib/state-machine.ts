import { BusinessException } from './business-exception';
import { ErrorCode } from './error-codes';

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export function defineStateMachine<S extends string>(name: string, transitions: TransitionMap<S>) {
  return {
    name,
    transitions,
    canTransition(from: S, to: S): boolean {
      return (transitions[from] as readonly S[]).includes(to);
    },
    assertTransition(from: S, to: S): void {
      if (!this.canTransition(from, to)) {
        const allowed = transitions[from] as readonly S[];
        throw new BusinessException(
          ErrorCode.INVALID_STATE_TRANSITION,
          `Cannot transition ${name} from ${from} to ${to}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
        );
      }
    },
  };
}
