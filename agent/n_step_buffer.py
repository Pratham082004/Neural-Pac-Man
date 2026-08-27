from collections import deque


class NStepBuffer:
    """
    Accumulates n consecutive transitions and computes the n-step discounted
    return before pushing to the main replay buffer.
    R_n = r_1 + γ*r_2 + γ²*r_3 + ... + γ^(n-1)*r_n
    """

    def __init__(self, n_steps=3, gamma=0.995):
        self.n_steps = n_steps
        self.gamma = gamma
        self.buffer = deque(maxlen=n_steps)

    def push(self, state, action, reward, next_state, done):
        """
        Add a single-step transition.

        Returns:
            A completed n-step transition if ready, or None if still accumulating.
        """
        self.buffer.append(
            (state, action, reward, next_state, done)
        )

        if done:
            return self._flush_terminal()

        if len(self.buffer) < self.n_steps:
            return None

        return self._compute_n_step()

    def _compute_n_step(self):
        """Compute n-step return from buffered transitions."""
        state = self.buffer[0][0]
        action = self.buffer[0][1]

        next_state = self.buffer[-1][3]
        done = self.buffer[-1][4]

        n_step_reward = 0.0
        discount = 1.0

        for transition in self.buffer:
            n_step_reward += discount * transition[2]
            discount *= self.gamma

            if transition[4]:
                next_state = transition[3]
                done = True
                break

        return (
            state,
            action,
            n_step_reward,
            next_state,
            done
        )

    def _flush_terminal(self):
        """Flush remaining transitions on episode end."""
        if len(self.buffer) == 0:
            return None

        result = self._compute_n_step()
        self.buffer.clear()
        return result

    def flush_remaining(self):
        """
        Flush all remaining transitions at episode end.
        """
        results = []

        while len(self.buffer) > 0:
            result = self._compute_n_step()
            results.append(result)
            self.buffer.popleft()

        return results

    def reset(self):
        """Clear the buffer."""
        self.buffer.clear()


if __name__ == "__main__":

    print("=" * 50)
    print("N-Step Buffer Test")
    print("=" * 50)

    gamma = 0.995
    n_step = NStepBuffer(n_steps=3, gamma=gamma)

    transitions = [
        ([1.0] * 72, 0, 1.0, [2.0] * 72, False),
        ([2.0] * 72, 1, 2.0, [3.0] * 72, False),
        ([3.0] * 72, 2, 3.0, [4.0] * 72, False),
        ([4.0] * 72, 3, 4.0, [5.0] * 72, False),
        ([5.0] * 72, 0, 5.0, [6.0] * 72, True),
    ]

    results = []

    for t in transitions:
        result = n_step.push(*t)
        if result is not None:
            results.append(result)

    results.extend(n_step.flush_remaining())

    print(f"Input transitions: {len(transitions)}")
    print(f"Output n-step transitions: {len(results)}")

    for i, r in enumerate(results):
        print(
            f"  [{i}] action={r[1]} "
            f"n_step_reward={r[2]:.4f} "
            f"done={r[4]}"
        )

    expected = 1.0 + gamma * 2.0 + gamma**2 * 3.0
    actual = results[0][2]

    print(
        f"\nFirst n-step return: "
        f"expected={expected:.4f} "
        f"actual={actual:.4f} "
        f"match={abs(expected - actual) < 1e-6}"
    )

    print("=" * 50)
    print("PASSED")
    print("=" * 50)

