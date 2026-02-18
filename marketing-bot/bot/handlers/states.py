from aiogram.fsm.state import State, StatesGroup


class OnboardingState(StatesGroup):
    waiting_for_level_answers = State()
    waiting_for_level_confirmation = State()


class ChatState(StatesGroup):
    active = State()   # в диалоге с агентом по конкретному проекту
