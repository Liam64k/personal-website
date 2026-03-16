import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

// Initialize game window
// Initalize board class
// Player input
// Sets up board and other components (text/buttons)
// Start, end, and update screen classes

public class Main extends JPanel implements KeyListener, ActionListener, BoardListener
{
    private JFrame _gui;
    private JLabel _score; // Game score
    private JLabel _gameOverLabel;
    private Board _board;
    private JPanel _startScreen; // Add buttons and text to this panel instead of _gui
    private JPanel _endScreen;
    private String _mapSelected;
    private JButton _startButton;
    private JButton _smallMap;
    private JButton _mediumMap;
    private JButton _largeMap;
    private JButton _slowSpeed;
    private JButton _mediumSpeed;
    private JButton _fastSpeed;
    private JButton _blockFrenzy;
    private JButton _peaceful;
    private JLabel _title;
    private JLabel _gameMode;
    private static boolean _mapChosen = false;
    private static boolean _speedChosen = false;
    private static int _MAPSIZE = 600;

    public Main() throws Exception
    {
        // Initialize gui
        _gui = new JFrame("GUI"); // Make frame
        _gui.getContentPane().setPreferredSize(new Dimension(_MAPSIZE, _MAPSIZE+75)); // Frame size
        _gui.pack(); // Adjust frame to fit size
        _gui.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE); // Stop program once frame is closed
        _gui.setLayout(null); // Null layout
        _gui.setResizable(false); // Non-resizable
        _gui.setVisible(true); // Make the screen visible

        // Initialize board
        _board = new Board(_MAPSIZE);
        _board.addKeyListener(this); // Gui responds to key actions
        _board.setBoardListener(this); // // Sets up a listener to handle board events

        // Initialize start screen
        _startScreen = new JPanel();
        _startScreen.setLayout(null);
        _startScreen.setBounds(0, 0, _MAPSIZE, _MAPSIZE+75);
        _startScreen.setBackground(Color.BLACK);
        _gui.add(_startScreen);

        _score = new JLabel("");
        _score.setBounds(10, _MAPSIZE, _MAPSIZE, 50);
        _score.setFont(new Font("Arial", Font.BOLD, 40)); // Set font, style, and size
        _score.setForeground(Color.RED); // Set the _score color
        _score.setVisible(false);
        _gui.add(_score);

        _startButton = new JButton("START");
        _startButton.setBounds(250, 550, 100, 50);
        _startButton.addActionListener(this);

        _smallMap = new JButton("Small Map");
        _smallMap.setBounds(100, 100, 100, 100);
        _smallMap.addActionListener(this);

        _mediumMap = new JButton("Medium Map");
        _mediumMap.setBounds(250, 100, 100, 100);
        _mediumMap.addActionListener(this);

        _largeMap = new JButton("Large Map");
        _largeMap.setBounds(400, 100, 100, 100);
        _largeMap.addActionListener(this);

        _slowSpeed = new JButton("Slow Speed");
        _slowSpeed.setBounds(100, 225, 100, 100);
        _slowSpeed.addActionListener(this);

        _mediumSpeed = new JButton("Medium Speed");
        _mediumSpeed.setBounds(250, 225, 100, 100);
        _mediumSpeed.addActionListener(this);

        _fastSpeed = new JButton("Fast Speed");
        _fastSpeed.setBounds(400, 225, 100, 100);
        _fastSpeed.addActionListener(this);

        _blockFrenzy = new JButton("Block Frenzy");
        _blockFrenzy.setBounds(160, 390, 100, 100);
        _blockFrenzy.addActionListener(this);

        _peaceful = new JButton("Peaceful");
        _peaceful.setBounds(340, 390, 100, 100);
        _peaceful.addActionListener(this);

        _title = new JLabel("Snake Game");
        _title.setBounds(90, 10, 500, 65);
        _title.setFont(new Font("Arial", Font.BOLD, 70)); // Set font, style, and size
        _title.setForeground(Color.GREEN); // Set the text color

        _gameMode = new JLabel("GAME MODES");
        _gameMode.setBounds(230, 325, 500, 65);
        _gameMode.setFont(new Font("Arial", Font.ROMAN_BASELINE, 20)); // Set font, style, and size
        _gameMode.setForeground(Color.BLUE); // Set the text color


        // Initialize end screen
        _endScreen = new JPanel();
        _endScreen.setLayout(null);
        _endScreen.setBackground(Color.BLACK); // Semi-transparent black to cover the game area
        _endScreen.setBounds(0, 0, _MAPSIZE, _MAPSIZE + 75); // Cover the entire board area

        // Add a label to indicate game over
        _gameOverLabel = new JLabel("");
        _gameOverLabel.setFont(new Font("Arial", Font.BOLD, 100)); // Set font size
        _gameOverLabel.setForeground(Color.RED); // Set _score color to red
        _gameOverLabel.setBounds(40, 100, 600, 300); // Position the label
        _endScreen.add(_gameOverLabel);

        // Add buttons and text to start screen
        _startScreen.add(_score);
        _startScreen.add(_startButton);
        _startScreen.add(_smallMap);
        _startScreen.add(_mediumMap);
        _startScreen.add(_largeMap);
        _startScreen.add(_slowSpeed);
        _startScreen.add(_mediumSpeed);
        _startScreen.add(_fastSpeed);
        _startScreen.add(_blockFrenzy);
        _startScreen.add(_peaceful);
        _startScreen.add(_title);
        _startScreen.add(_gameMode);
    }

    public static void main(String[] args) throws Exception
    {
        Main mainPanel = new Main();
    }

    // Player input
    public void keyTyped(KeyEvent e)
    {
        switch(e.getKeyChar())
        {
            case 'w': _board.setDirection('w'); break;
            case 'a': _board.setDirection('a'); break;
            case 's': _board.setDirection('s'); break;
            case 'd': _board.setDirection('d'); break;
        }
    }

    public void keyPressed(KeyEvent e)
    {
    }

    // Quit game for peaceful mode
    public void keyReleased(KeyEvent e)
    {
        int keyCode = e.getKeyCode();
        if(keyCode == KeyEvent.VK_ESCAPE)
        {
            System.exit(0);
        }
    }

    // Update game score
    public void updateGame(int length, int condition)
    {
        _score.setText("Score: " + String.valueOf(length) + "/" + condition + "    SNAKE GAME");
    }

    // Add end screen to gui
    public void endGame(String outcome)
    {
        _gui.remove(_board);

        _gameOverLabel.setText(outcome);
        _gui.add(_endScreen);
        _gui.repaint();

        try // Wait before showing home screen
        {
            Thread.sleep(2500);
            _gui.remove(_endScreen);
            _gui.remove(_score);

            _gui.add(_startScreen);
            _gui.repaint();
        }
        catch (Exception e)
        {
            System.err.println(e);
        }
    }

    // Start game
    public void actionPerformed(ActionEvent e)
    {
        if (e.getSource() == _startButton)
        {
            if (_mapChosen && _speedChosen) // Make sure map and speed have been chosen before starting
            {
                _gui.remove(_startScreen);

                _gui.add(_board);
                _gui.add(_score);
                _score.setVisible(true);

                _board.requestFocusInWindow();
                _gui.repaint();

                try // Create map based on the map size selected
                {
                    if (_mapSelected == "MapSmall.txt")
                    {
                        _board.readFile("MapSmall.txt");
                    }
                    else if (_mapSelected == "MapMedium.txt")
                    {
                        _board.readFile("MapMedium.txt");
                    }
                    else
                    {
                        _board.readFile("MapLarge.txt");
                    }
                }
                catch (Exception ex)
                {

                }
                Thread gameThread = new Thread(_board);
                gameThread.start();
            }
        }
        else if(e.getSource() == _smallMap)
        {
            _mapSelected = "MapSmall.txt";
            _smallMap.setBackground(Color.GREEN); // Change background color to red
            _mediumMap.setBackground(null); // Change background color to red
            _largeMap.setBackground(null); // Change background color to red
            _mapChosen = true;

            // Repaint the GUI to show changes
            _startScreen.repaint();
        }
        else if(e.getSource() == _mediumMap)
        {
            _mapSelected = "MapMedium.txt";
            _smallMap.setBackground(null);
            _mediumMap.setBackground(Color.GREEN);
            _largeMap.setBackground(null);
            _mapChosen = true;

            _startScreen.repaint();
        }
        else if(e.getSource() == _largeMap)
        {
            _mapSelected = "MapLarge.txt";
            _smallMap.setBackground(null);
            _mediumMap.setBackground(null);
            _largeMap.setBackground(Color.GREEN);
            _mapChosen = true;

            _startScreen.repaint();
        }
        else if(e.getSource() == _slowSpeed)
        {
            _board.setSpeed(85);
            _slowSpeed.setBackground(Color.GREEN);
            _mediumSpeed.setBackground(null);
            _fastSpeed.setBackground(null);
            _speedChosen = true;

            _startScreen.repaint();
        }
        else if(e.getSource() == _mediumSpeed)
        {
            _board.setSpeed(65);
            _slowSpeed.setBackground(null);
            _mediumSpeed.setBackground(Color.GREEN);
            _fastSpeed.setBackground(null);
            _speedChosen = true;

            _startScreen.repaint();
        }
        else if(e.getSource() == _fastSpeed)
        {
            _board.setSpeed(40);
            _slowSpeed.setBackground(null);
            _mediumSpeed.setBackground(null);
            _fastSpeed.setBackground(Color.GREEN);
            _speedChosen = true;

            _startScreen.repaint();
        }
        else if(e.getSource() == _blockFrenzy)
        {
            if (_mapChosen && _speedChosen)
            {
                if (_blockFrenzy.getBackground() == Color.GREEN)
                {
                    _board.blockFrenzyEnabled(false);
                    _blockFrenzy.setBackground(null);
                }
                else
                {
                    _board.blockFrenzyEnabled(true);
                    _board.peaceful(false);
                    _peaceful.setBackground(null);
                    _blockFrenzy.setBackground(Color.GREEN);
                    _startScreen.repaint();
                }
            }
        }
        else if(e.getSource() == _peaceful)
        {
            if (_mapChosen && _speedChosen)
            {
                if (_peaceful.getBackground() == Color.GREEN)
                {
                    _board.peaceful(false);
                    _peaceful.setBackground(null);
                }
                else
                {
                    _board.peaceful(true);
                    _board.blockFrenzyEnabled(false);
                    _peaceful.setBackground(Color.GREEN);
                    _blockFrenzy.setBackground(null);
                    _startScreen.repaint();
                }
            }
        }
    }
}