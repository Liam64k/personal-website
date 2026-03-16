import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

public class Terrain extends JPanel implements Runnable
{
    private int _guiWidth;
    private int _guiHeight;
    private int[] _YArray;
    private static int _pointRadius = 3; // greater is less
    private static BufferedImage _perlinImage;

    public Terrain(int guiWidth, int guiHeight, int resolution) throws Exception
    {
        _guiWidth = guiWidth;
        _guiHeight = guiHeight;

        _YArray = new int[_guiWidth/resolution];

        _perlinImage = ImageIO.read(new File("src/perlin-noise-texture.png"));
        setYArray(0);
    }

    public void run()
    {
        try
        {
            int i = 0;
            while (true)
            {
                repaint();
                setYArray(i++);
                Thread.sleep(50); // Slows down while loop so laptop doesn't crash
            }
        }
        catch(Exception e)
        {

        }

    }

    public int[] getYArray()
    {
        return _YArray;
    }

    public void setYArray(int time)
    {
        int imgHeight = _perlinImage.getHeight();
        int imgWidth = _perlinImage.getWidth();

        for (int i = 0; i < _YArray.length; i++)
        {
            int x = (i * imgWidth) / _YArray.length;
            int gray = _perlinImage.getRGB(x, time%imgHeight) & 0xFF; // time%imgHeight gets remainder to loop
            _YArray[i] = (_guiHeight * gray) / 255;
            System.out.println(gray);
        }
    }

    public void paintComponent(Graphics gui)
    {
        super.paintComponent(gui);

        for (int i = 1; i <_YArray.length; i++) // draw rectangles
        {
            int x = ((i-1) * _guiWidth) / (_YArray.length - 1);
            int x2 = i * _guiWidth / (_YArray.length - 1);


            int dirtVal = Math.min(100, (_YArray[i] - 100) / 4 + 50);
            Color dirtColor = new Color(150, dirtVal, 0);

            int soilVal = Math.min(100, (_YArray[i] - 100) / 4 + 50);
            Color soilColor = new Color(154, soilVal+10, 3);

            int cliffRandom = (int)(Math.random() * (20 + 1));
            int mountainTopRandom = (int)(Math.random() * (13 + 1));

            int cliffVal = Math.min(200, Math.max(50, (_YArray[i] - 100) / 2 + 60));
            Color cliffColor = new Color(cliffVal, cliffVal, cliffVal);

            int snowVal = Math.min(255, Math.max(200, 255 - _YArray[i] / 2));
            Color snowWhite = new Color(snowVal, snowVal, snowVal);

            int greenVal = Math.max(100, 255 - (_YArray[i] - 150));
            greenVal = Math.min(greenVal, 255);
            Color grassGreen = new Color(0, greenVal, 0);

            // Base brown layer
            gui.setColor(dirtColor);
            gui.fillRect(x, _YArray[i], x2-x, _guiHeight - _YArray[i]);

            // Cliffs & Grass & Mountain tops
            if (_YArray[i-1] - _YArray[i] > 20)
            {
                gui.setColor(cliffColor);
                gui.fillRect(x, _YArray[i], x2-x, _YArray[i-1] - _YArray[i] + 40 + cliffRandom);
            }
            else if (_YArray[i-1] - _YArray[i] < -20)
            {
                gui.setColor(cliffColor);
                gui.fillRect(x, _YArray[i], x2-x, _YArray[i] - _YArray[i-1] + 40 + cliffRandom);
            }

            else // Mountain tops
            {
                if (_YArray[i] < 150)
                {
                    int temp = 10 + mountainTopRandom;

                    gui.setColor(snowWhite);
                    gui.fillRect(x, _YArray[i], x2-x, temp);

                    gui.setColor(cliffColor);
                    gui.fillRect(x, _YArray[i] + temp, x2-x, 10 + cliffRandom);
                }
                else
                {
                    gui.setColor(grassGreen);
                    gui.fillRect(x, _YArray[i], x2-x, 15);
                }
            }

        }

        /*
        for (int i = 0; i < _YArray.length; i++) // draw vertices
        {
            int x1 = (i * _guiWidth) / (_YArray.length - 1);

            gui.setColor(Color.black);
            gui.drawOval(x1 - _pointRadius, _YArray[i] - _pointRadius, _pointRadius * 2, _pointRadius * 2);
        }

        for (int i = 1; i <_YArray.length; i++) // draw lines
        {
            int x1 = (i - 1) * _guiWidth / (_YArray.length - 1);
            int x2 = i * _guiWidth / (_YArray.length - 1);

            gui.setColor(Color.black);
            gui.drawLine(x1, _YArray[i-1], x2, _YArray[i]);
        }
        */
    }
}
