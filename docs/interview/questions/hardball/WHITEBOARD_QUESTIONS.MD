# Multimodal Whiteboard Debugging Framework
When you do start building the whiteboard integration, you'll want to test specific multimodal triggers. Here are a few ways to structure the questions to see if your AI evaluator is successfully merging the voice and canvas data streams:
• The Canvas Reference Test: "Draw a standard 3-tier architecture on the board, and tell me how you would make it resilient against a full AWS region failure." (Tests if the AI can map the spoken words "this database box" to the coordinates on the screen).
• The Fault Isolation Test: "Sketch a microservices mesh. Now, draw an X over the payment service. Walk me through how the surrounding services should gracefully degrade." (Tests if the AI can interpret real-time updates and destructive canvas edits).
