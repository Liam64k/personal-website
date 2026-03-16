import javax.swing.*;
import java.awt.*;

// Single tile class that holds all the information for each individual tile
// Paints the tile on the Board based on the information (xPos, yPos, _status, _counter)

public class Tile
{
    public static int _size;

    private int _xPos;
    private int _yPos;
    private char _status;
    private int _counter; // Snake length to help draw snake
    private static ImageIcon _apple = new ImageIcon(Tile.class.getResource("apple1.png"));
    private static ImageIcon _brickwall = new ImageIcon(Tile.class.getResource("brickwall.png"));
    private static ImageIcon _concrete = new ImageIcon(Tile.class.getResource("concrete.png"));
    private static ImageIcon _snakebody = new ImageIcon(Tile.class.getResource("snakebody.png"));
    private static ImageIcon _snakeHead = new ImageIcon(Tile.class.getResource("snakehead.png"));

    public Tile(int xPos, int yPos, char status)
    {
        _xPos = xPos;
        _yPos = yPos;
        _status = status;
    }

    public String toString()
    {
        return _xPos + " " + _yPos + " " + _size + " " + _status + " " + _counter;
    }

    // Draw tile based on position, size, and image
    public void paint(Graphics gui)
    {
        int xPos = _xPos*_size;
        int yPos = _yPos*_size;
        switch (_status)
        {
            case 'w':
                gui.drawImage(_brickwall.getImage(), xPos, yPos, _size, _size, null);
                break;
            case 'e':
                gui.drawImage(_concrete.getImage(), xPos, yPos, _size, _size, null);
                break;
            case 's':
                gui.drawImage(_snakebody.getImage(), xPos, yPos, _size, _size, null);
                break;
            case 'a':
                gui.drawImage(_apple.getImage(), xPos, yPos, _size, _size, null);
                break;
            case 'h':
                gui.drawImage(_snakeHead.getImage(), xPos, yPos, _size, _size, null);
                break;
        }
    }

    public void setStatus(char status)
    {
        _status = status;
    }

    public char getStatus()
    {
        return _status;
    }

    public void counterSubtract()
    {
        _counter--;
    }

    public int getCounter()
    {
        return _counter;
    }

    public void setCounter(int snakeLength)
    {
        _counter = snakeLength;
    }
}
