import os
import shutil

def arrange_project():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(root_dir, 'project')

    if not os.path.exists(project_dir):
        print("Error: 'project' folder does not exist. Files might have already been moved.")
        return

    items_to_move = ['main.py', 'requirements.txt', 'backend', 'static']

    for item in items_to_move:
        src = os.path.join(project_dir, item)
        dest = os.path.join(root_dir, item)
        
        if os.path.exists(src):
            if os.path.exists(dest):
                print(f"Destination '{item}' already exists, skipping...")
            else:
                shutil.move(src, dest)
                print(f"Moved: {item}")
        else:
            print(f"Warning: {item} not found in 'project' folder.")

    # Try to remove the project directory if it's empty
    try:
        if len(os.listdir(project_dir)) == 0:
            os.rmdir(project_dir)
            print("Cleanup: Removed empty 'project' folder.")
        else:
            print(f"Notice: 'project' folder is not empty. Contents left inside: {os.listdir(project_dir)}")
    except OSError as e:
        print(f"Could not remove 'project' directory: {e}")

if __name__ == '__main__':
    arrange_project()
