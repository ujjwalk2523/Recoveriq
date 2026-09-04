from typing import Dict, List, Optional
from pydantic import BaseModel

class ActionDefinition(BaseModel):
    action_id: str
    display_name: str
    base_cost: float
    contact_required: bool
    risk_level: str
    supported_payment_methods: List[str]
    description: str

APPROVED_ACTIONS: Dict[str, ActionDefinition] = {
    "IMMEDIATE_RETRY": ActionDefinition(
        action_id="IMMEDIATE_RETRY",
        display_name="Immediate Gateway Retry",
        base_cost=3.50,
        contact_required=False,
        risk_level="LOW",
        supported_payment_methods=["UPI", "CARD", "NETBANKING"],
        description="Instant background retry through alternative payment aggregator",
    ),
    "OPTIMAL_DELAYED_RETRY": ActionDefinition(
        action_id="OPTIMAL_DELAYED_RETRY",
        display_name="Optimal Delayed Retry",
        base_cost=3.50,
        contact_required=False,
        risk_level="LOW",
        supported_payment_methods=["UPI", "CARD", "NETBANKING"],
        description="Scheduled retry delayed to optimal clearing window",
    ),
    "PAYMENT_LINK": ActionDefinition(
        action_id="PAYMENT_LINK",
        display_name="Multi-Rail Payment Link",
        base_cost=8.00,
        contact_required=True,
        risk_level="LOW",
        supported_payment_methods=["UPI", "CARD", "NETBANKING", "WALLET"],
        description="SMS / Email with instant checkout link across alternative rails",
    ),
    "WHATSAPP_NUDGE": ActionDefinition(
        action_id="WHATSAPP_NUDGE",
        display_name="WhatsApp Conversational Nudge",
        base_cost=1.50,
        contact_required=True,
        risk_level="LOW",
        supported_payment_methods=["UPI", "CARD", "NETBANKING", "WALLET"],
        description="Interactive WhatsApp template message with quick-pay button",
    ),
    "MANDATE_UPDATE": ActionDefinition(
        action_id="MANDATE_UPDATE",
        display_name="Recurring Mandate Fix",
        base_cost=12.00,
        contact_required=True,
        risk_level="MEDIUM",
        supported_payment_methods=["CARD", "NETBANKING"],
        description="Prompt customer to refresh UPI autopay or e-mandate instrument",
    ),
    "HUMAN_ESCALATION": ActionDefinition(
        action_id="HUMAN_ESCALATION",
        display_name="VIP White-Glove Desk",
        base_cost=45.00,
        contact_required=True,
        risk_level="MEDIUM",
        supported_payment_methods=["UPI", "CARD", "NETBANKING", "WALLET"],
        description="Direct outreach by customer success manager for enterprise ticket",
    ),
    "DO_NOT_RECOVER": ActionDefinition(
        action_id="DO_NOT_RECOVER",
        display_name="Suppress / Do Not Recover",
        base_cost=0.00,
        contact_required=False,
        risk_level="NONE",
        supported_payment_methods=["UPI", "CARD", "NETBANKING", "WALLET"],
        description="Cease recovery attempts due to fraud risk, user block, or fatigue limits",
    ),
}

class ActionSpace:
    @staticmethod
    def get_all_action_ids() -> List[str]:
        return list(APPROVED_ACTIONS.keys())

    @staticmethod
    def get_action(action_id: str) -> Optional[ActionDefinition]:
        return APPROVED_ACTIONS.get(action_id)

    @staticmethod
    def is_valid_action(action_id: str) -> bool:
        return action_id in APPROVED_ACTIONS

    @staticmethod
    def filter_candidate_actions(candidates: Optional[List[str]]) -> List[str]:
        if not candidates:
            return list(APPROVED_ACTIONS.keys())
        valid = [a for a in candidates if a in APPROVED_ACTIONS]
        if not valid:
            raise ValueError(f"None of candidate actions {candidates} are in the approved RecoverIQ action space!")
        return valid
