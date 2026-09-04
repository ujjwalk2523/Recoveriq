from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional
import numpy as np

class AbstractBandit(ABC):
    @abstractmethod
    def select_action(
        self,
        context_vector: np.ndarray,
        candidate_actions: List[str],
        random_seed: Optional[int] = None,
    ) -> Tuple[str, str, str, Dict[str, float], float, float]:
        """
        Returns:
            selected_action: str
            best_expected_action: str
            selection_mode: str ('EXPLOIT' | 'EXPLORE')
            action_scores: Dict[str, float]
            expected_reward: float
            exploration_probability: float
        """
        pass

    @abstractmethod
    def update(
        self,
        action: str,
        context_vector: np.ndarray,
        reward: float,
    ) -> None:
        """
        Updates the bandit parameters using the observed context and reward.
        """
        pass
