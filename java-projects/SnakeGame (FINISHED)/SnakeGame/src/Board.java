import javax.swing.*;
import java.awt.*;
import java.io.BufferedReader;
import java.io.FileReader;

// Board JPanel
// Update Board
// Change tile statuses
// Snake movement
// Spawning apple
// Collision
// Reads a File IO and turns it into a 2D array of Tiles which is a grid

public class Board extends JPanel implements Runnable
{
    private int _numTiles;
    private int _mapSize;
    private char _direction;
    private int _SHX; // Snake head X position
    private int _SHY; // Snake head y position
    private Tile[][] _map;
    private BoardListener _listener;
    private static boolean _spawnApple = false;
    private static int _speed = 40; // Bigger is slower
    private static int _snakeLength = 3;
    private static boolean _hasMoved = false;
    private static boolean _blockFrenzyEnabled = false;
    private static boolean _peaceful = false;
    private static int _winCondition;

    public Board(int mapSize) throws Exception
    {
        _mapSize = mapSize;

        this.setBounds(0, 0, _mapSize, _mapSize);
    }

    // Assigns the listener to handle game updates and outcomes
    public void setBoardListener(BoardListener listener)
    {
        _listener = listener;
    }

    // Main game loop: handles snake movement, collision detection, and game updates
    public void run()
    {
        try
        {
            boolean running = true;
            while (running)
            {
                switch (_direction)
                {
                    case 'w':
                    {
                        int temp = _SHY;
                        if (_peaceful == true) // If peaceful mode is enabled
                        {
                            if (_map[_SHX - 1][_SHY].getStatus() == 'w') // Move snake head across map
                            {
                                _SHX = _numTiles-1;
                                _SHY = temp;
                            }
                        }
                        else // If the game is playing normally
                        {
                            if (_map[_SHX - 1][_SHY].getStatus() == 's' || _map[_SHX - 1][_SHY].getStatus() == 'w') // End run if you collide
                            {
                                running = false;
                            }
                        }
                        if (_map[_SHX - 1][_SHY].getStatus() == 'a')
                        {
                            _spawnApple = true; // Enable spawn apple to spawn a new one
                        }

                        if (running) // Make sure not to draw snake head in wall if collides
                        {
                            _map[_SHX - 1][_SHY].setStatus('h'); // Set snake heads location
                            if (_map[_SHX][_SHY].getStatus() != 'w')
                            {
                                _map[_SHX][_SHY].setStatus('s');
                            }
                            _map[_SHX - 1][_SHY].setCounter(_snakeLength-1); // Update counter
                            _SHX -= 1; // Update snake head's position
                        }
                        break;
                    }
                    case 'a':
                    {
                        int temp = _SHX;
                        if (_peaceful == true)
                        {
                            if (_map[_SHX][_SHY - 1].getStatus() == 'w')
                            {
                                _SHX = temp;
                                _SHY = _numTiles-1;
                            }
                        }
                        else
                        {
                            if (_map[_SHX][_SHY - 1].getStatus() == 'w' || _map[_SHX][_SHY - 1].getStatus() == 's')
                            {
                                running = false;
                            }
                        }
                        if (_map[_SHX][_SHY - 1].getStatus() == 'a')
                        {
                            _spawnApple = true;
                        }

                        if (running)
                        {
                            _map[_SHX][_SHY - 1].setStatus('h');
                            if (_map[_SHX][_SHY].getStatus() != 'w')
                            {
                                _map[_SHX][_SHY].setStatus('s');
                            }
                            _map[_SHX][_SHY - 1].setCounter(_snakeLength-1);
                            _SHY -= 1; // Update snake head's position
                        }
                        break;
                    }
                    case 's':
                    {
                        int temp = _SHY;
                        if (_peaceful == true)
                        {
                            if (_map[_SHX + 1][_SHY].getStatus() == 'w')
                            {
                                _SHX = 0;
                                _SHY = temp;
                            }
                        }
                        else
                        {
                            if (_map[_SHX + 1][_SHY].getStatus() == 'w' || _map[_SHX + 1][_SHY].getStatus() == 's')
                            {
                                running = false;
                            }
                        }
                        if (_map[_SHX + 1][_SHY].getStatus() == 'a')
                        {
                            _spawnApple = true;
                        }

                        if (running)
                        {
                            _map[_SHX + 1][_SHY].setStatus('h');
                            if (_map[_SHX][_SHY].getStatus() != 'w')
                            {
                                _map[_SHX][_SHY].setStatus('s');
                            }
                            _map[_SHX + 1][_SHY].setCounter(_snakeLength-1);
                            _SHX += 1; // Update snake head's position
                        }
                        break;
                    }
                    case 'd':
                    {
                        int temp = _SHX;
                        if (_peaceful == true)
                        {
                            if (_map[_SHX][_SHY + 1].getStatus() == 'w')
                            {
                                _SHX = temp;
                                _SHY = 0;
                            }
                        }
                        else
                        {
                            if (_map[_SHX][_SHY + 1].getStatus() == 'w' || _map[_SHX][_SHY + 1].getStatus() == 's')
                            {
                                running = false;
                            }
                        }

                        if (_map[_SHX][_SHY + 1].getStatus() == 'a')
                        {
                            _spawnApple = true;
                        }

                        if (running)
                        {
                            _map[_SHX][_SHY + 1].setStatus('h');
                            if (_map[_SHX][_SHY].getStatus() != 'w')
                            {
                                _map[_SHX][_SHY].setStatus('s');
                            }
                            _map[_SHX][_SHY + 1].setCounter(_snakeLength-1);
                            _SHY += 1; // Update snake head's position
                        }
                        break;
                    }
                }
                repaint();
                Thread.sleep(_speed); // Pause between loop iteration
            }
            if (_snakeLength == _winCondition) // Determine if you won or lost
            {
                _listener.endGame("YOU WON");
            }
            else
            {
                _listener.endGame("YOU LOST");
            }
        }
        catch (Exception e)
        {
            System.out.println(e);
        }
    }

    protected void paintComponent(Graphics gui) // Called when repaint is called. Updates board class based on tile changes
    {
        for (int i = 0; i < _numTiles; i++)
        {
            for (int n = 0; n < _numTiles; n++)
            {
                _hasMoved = false;
                _map[i][n].paint(gui);
                if (_map[i][n].getStatus() == 's' || _map[i][n].getStatus() == 'h')
                {
                    _map[i][n].counterSubtract();
                    if (_map[i][n].getCounter() < 0)
                    {
                        _map[i][n].setStatus('e');
                    }
                }
            }
            while (_spawnApple) // Spawn apple if previous one was collected
            {
                int xa = (int) (Math.random() * (_numTiles - 2)) + 2;
                int ya = (int) (Math.random() * (_numTiles - 2)) + 2;
                if (_map[xa][ya].getStatus() == 'e')
                {
                    _map[xa][ya].setStatus('a');
                    _snakeLength++;
                    _listener.updateGame(_snakeLength, _winCondition);

                    if (_blockFrenzyEnabled) // If blockFrenzy is enabled spawn a block also
                    {
                        int xb = (int) (Math.random() * (_numTiles - 2)) + 2;
                        int yb = (int) (Math.random() * (_numTiles - 2)) + 2;
                        while(true)
                        {
                            if (_map[xb][yb].getStatus() == 'e')
                            {
                                _map[xb][yb].setStatus('w');
                                break;
                            }
                            else
                            {
                                xb = (int) (Math.random() * (_numTiles - 2)) + 2;
                                yb = (int) (Math.random() * (_numTiles - 2)) + 2;
                            }
                        }
                    }
                    _spawnApple = false;
                }
            }
        }
    }

    // Create 2D array which is the map based on the file IO
    public void readFile(String fileName) throws Exception
    {
        FileReader fr = new FileReader(fileName); // Get map size
        BufferedReader br = new BufferedReader(fr);
        String line = br.readLine();

        _numTiles = line.length();
        Tile._size = (int)(_mapSize/_numTiles);
        _direction = 'd';
        _map = new Tile[_numTiles][_numTiles];
        _winCondition = _numTiles*_numTiles - (_numTiles*2) - ((_numTiles-2)*2);
        _snakeLength = 3;

        _listener.updateGame(_snakeLength, _winCondition);

        int row = 0;
        int column = 0;
        do
        {
            for (int i = 0; i < line.length() && column < _numTiles; i++) // Go through every character in every line
            {
                if (line.charAt(i) == 'w') // If tile is a wall
                {
                    _map[row][column] = new Tile(column, row, 'w');
                }
                else if (line.charAt(i) == 'e')// If tile is empty
                {
                    _map[row][column] = new Tile(column, row, 'e');
                }
                else if (line.charAt(i) == 's')// If tile is snake
                {
                    _map[row][column] = new Tile(column, row, 's');
                    _SHX = row;
                    _SHY = column;
                }
                else // If tile is an apple
                {
                    _map[row][column] = new Tile(column, row, 'a');
                }

                column++;
            }
            column = 0;
            row++;
        }
        while ((line = br.readLine()) != null); // Go through every line and make sure row is in bounds
        br.close();
    }

    public void setSpeed(int speed)
    {
        _speed = speed;
    }

    // Update _direction variable based on players input
    public void setDirection(char direction)
    {
        if (_hasMoved == false)
        {
            switch (direction)
            {
                case 'w':
                {
                    if (_direction != 's')
                    {
                        _direction = 'w';
                        _hasMoved = true;
                    }
                    break;
                }
                case 'a':
                {
                    if (_direction != 'd')
                    {
                        _direction = 'a';
                        _hasMoved = true;
                    }
                    break;
                }
                case 's':
                {
                    if (_direction != 'w')
                    {
                        _direction = 's';
                        _hasMoved = true;
                    }
                    break;
                }
                case 'd':
                {
                    if (_direction != 'a')
                    {
                        _direction = 'd';
                        _hasMoved = true;
                    }
                    break;
                }
            }
        }
    }

    // Enable blockFrenzy
    public void blockFrenzyEnabled(boolean blockFrenzyEnabled)
    {
        _blockFrenzyEnabled = blockFrenzyEnabled;
    }

    // Enable peaceful
    public void peaceful(boolean peaceful)
    {
        _peaceful = peaceful;
    }

}