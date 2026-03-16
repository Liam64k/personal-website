public interface BoardListener
{
  void updateGame(int length, int condition); // Updates the game state with the current score and win condition.
  void endGame(String outcome); // Handles the end of the game and displays the outcome.
}
