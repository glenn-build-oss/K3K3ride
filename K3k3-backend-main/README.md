# K3k3-backend

### How To Run

#### Creating an environment
* Use python with version 3.13.*
* create an environment by calling `ctrl + shift + p` 
* Select `Python: Select Interpreter` 
* Select `Create Virtual Environment`
* Select `Venv`
* Select the version to create the environment on (3.13.*)
* Install requirements by checking the checkbox or after creating the environment:
    - In the terminal check is you are in the environment eg. `(.venv) macbook@MACBOOKs-MacBook-Air backend ` the (.venv) shows that you are in an env
    - if not, in the terminal 
        - Command Prompt `venv\Scripts\activate.`
        - PowerShell `.\venv\Scripts\Activate.ps1`
        - macOS `venv/bin/activate`
    - To install requirements use `pip install -r requirements.txt`
    - To verify call `pip freeze`

#### Create a database using sqlite For testing
DATABASE : `DB_URL="sqlite:///database.db"` in .env file, the `database.py` file will read it using the the variable `DB_URL`

#### TO run backend
* Go into the backend directory by calling `cd backend`
* Run `python3 main.py` or `python main.py`
* In the terminal, find `Uvicorn running on http://localhost:8810 (Press CTRL+C to quit)` and click on link
* In the address bar `http://localhost:8810` + `/docs` to see interactive SwaggerUI