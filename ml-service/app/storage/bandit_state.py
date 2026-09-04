import os
import json
from typing import Dict, Optional, Set
from ..bandits.contextual_thompson import ContextualThompsonSampling
from ..config import config

class BanditStateStore:
    """
    Manages merchant-isolated Contextual Bandit models and ensures idempotency.
    """
    
    def __init__(self, state_dir: Optional[str] = None):
        self.state_dir = state_dir or config.state_dir
        os.makedirs(self.state_dir, exist_ok=True)
        
        # In-memory cached bandit models per merchant
        self._bandits: Dict[str, ContextualThompsonSampling] = {}
        # Idempotency sets for decision and outcome IDs
        self._processed_decisions: Set[str] = set()
        self._processed_outcomes: Set[str] = set()

    def get_state_file(self, merchant_id: str) -> str:
        safe_id = "".join(c for c in merchant_id if c.isalnum() or c in ("_", "-"))
        return os.path.join(self.state_dir, f"bandit_{safe_id}.json")

    def get_bandit(self, merchant_id: str = "global") -> ContextualThompsonSampling:
        if merchant_id in self._bandits:
            return self._bandits[merchant_id]

        file_path = self.get_state_file(merchant_id)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    bandit = ContextualThompsonSampling.from_dict(data)
                    self._bandits[merchant_id] = bandit
                    return bandit
            except Exception as e:
                print(f"[BanditStateStore] Warning: Failed to load state for {merchant_id}: {e}")

        # Initialize fresh bandit for merchant
        bandit = ContextualThompsonSampling(
            dimension=28,
            lambda_prior=config.lambda_prior,
            exploration_variance=config.exploration_variance,
        )
        self._bandits[merchant_id] = bandit
        return bandit

    def save_bandit(self, merchant_id: str = "global") -> None:
        if merchant_id not in self._bandits:
            return

        file_path = self.get_state_file(merchant_id)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(self._bandits[merchant_id].to_dict(), f, indent=2)
        except Exception as e:
            print(f"[BanditStateStore] Error saving bandit state for {merchant_id}: {e}")

    def is_outcome_processed(self, outcome_key: str) -> bool:
        return outcome_key in self._processed_outcomes

    def mark_outcome_processed(self, outcome_key: str) -> None:
        self._processed_outcomes.add(outcome_key)

    def reset_state(self, merchant_id: Optional[str] = None) -> None:
        if merchant_id:
            self._bandits.pop(merchant_id, None)
            fp = self.get_state_file(merchant_id)
            if os.path.exists(fp):
                os.remove(fp)
        else:
            self._bandits.clear()
            self._processed_decisions.clear()
            self._processed_outcomes.clear()
            for fn in os.listdir(self.state_dir):
                if fn.endswith(".json"):
                    try:
                        os.remove(os.path.join(self.state_dir, fn))
                    except Exception:
                        pass

state_store = BanditStateStore()
